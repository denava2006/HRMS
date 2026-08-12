-- Forward-only migration. Nothing here edits an applied migration, drops data,
-- or rewrites historical rows.
--
-- 1. Server-side payment-reference validation for every NEW checkout call.
--    Existing public.sales rows are never re-validated or rewritten.
-- 2. Honest audit actions for stock changes: a sale deduction, a restock and a
--    manual adjustment are no longer all recorded as "Stock adjusted".

-- ---------------------------------------------------------------------------
-- 1. Payment-reference rules (mirrored by src/lib/paymentValidation.ts)
--    gcash / maya : 6-32 digits
--    bank         : 6-64 letters, digits, spaces, hyphens
--    other        : 1-64 printable characters
--    cash         : no reference at all
-- ---------------------------------------------------------------------------
create or replace function private.validate_payment_reference(
  _payment_method text,
  _payment_reference text
)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  _normalized text := nullif(btrim(coalesce(_payment_reference, '')), '');
begin
  if _payment_method = 'cash' then
    return null;
  end if;

  if _normalized is null then
    raise exception 'A payment reference is required for % payments', _payment_method;
  end if;

  if _payment_method in ('gcash', 'maya') then
    if _normalized !~ '^[0-9]{6,32}$' then
      raise exception 'A % reference must be 6-32 digits (numbers only)', _payment_method;
    end if;
  elsif _payment_method = 'bank' then
    if _normalized !~ '^[A-Za-z0-9 -]{6,64}$' then
      raise exception 'A bank reference must be 6-64 characters using letters, numbers, spaces or hyphens';
    end if;
  elsif _payment_method = 'other' then
    if char_length(_normalized) > 64 or _normalized ~ '[[:cntrl:]]' then
      raise exception 'A payment reference must be 1-64 printable characters';
    end if;
  else
    raise exception 'Invalid payment method';
  end if;

  return _normalized;
end;
$$;

revoke all on function private.validate_payment_reference(text, text) from public;

-- ---------------------------------------------------------------------------
-- 2. checkout_sale: validate the reference before the sale is written, and tag
--    the transaction so the product audit trigger can name the stock change.
--    public.secure_checkout is unchanged and stays revoked from every client
--    role; this is still the only reachable entry point.
-- ---------------------------------------------------------------------------
create or replace function public.checkout_sale(
  _store_id uuid,
  _items jsonb,
  _payment_method text,
  _payment_reference text default null,
  _amount_tendered numeric default null,
  _checkout_key uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _caller uuid := (select auth.uid());
  _role public.membership_role;
  _result jsonb;
  _reference text := _payment_reference;
  _is_retry boolean := false;
begin
  if _caller is null then raise exception 'Authentication required'; end if;
  select sm.role into _role
  from public.store_memberships sm
  where sm.store_id = _store_id
    and sm.user_id = _caller
    and sm.status = 'active';
  if _role is null then raise exception 'Active store membership required'; end if;
  if _checkout_key is null then raise exception 'Checkout key is required'; end if;

  -- A retry of an already-committed sale must return that exact sale, so it is
  -- never re-validated. This keeps failed-checkout retry behaviour identical
  -- and keeps references recorded before this migration untouched.
  select exists (
    select 1
    from public.sales s
    where s.store_id = _store_id
      and s.created_by = _caller
      and s.checkout_key = _checkout_key
  ) into _is_retry;

  if not _is_retry then
    _reference := private.validate_payment_reference(_payment_method, _payment_reference);
  end if;

  perform set_config('sariswift.stock_change_reason', 'sale', true);
  _result := public.secure_checkout(
    _store_id, _items, _payment_method, _reference,
    _amount_tendered, _checkout_key
  );
  -- Re-arm the direct-stock-write guard and clear the reason for the rest of
  -- the transaction. The guard itself is unchanged and never weakened.
  perform set_config('sariswift.stock_change_reason', '', true);
  perform set_config('sariswift.inventory_write', '', true);

  if _role = 'cashier' then
    return _result
      - 'total_profit' - 'total_cogs' - 'gross_profit' - 'net_profit';
  end if;
  return _result;
end;
$$;

revoke all on function public.checkout_sale(uuid, jsonb, text, text, numeric, uuid) from public;
revoke all on function public.checkout_sale(uuid, jsonb, text, text, numeric, uuid) from anon;
grant execute on function public.checkout_sale(uuid, jsonb, text, text, numeric, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. restock_product / adjust_product_stock: identical logic, plus the reason
--    tag so their audit rows say what actually happened.
-- ---------------------------------------------------------------------------
create or replace function public.restock_product(
  _store_id uuid,
  _product_id uuid,
  _quantity integer,
  _purchase_unit_cost numeric,
  _notes text default null
)
returns public.products
language plpgsql
security definer
set search_path = ''
as $$
declare
  _caller uuid := (select auth.uid());
  _product public.products%rowtype;
  _updated public.products%rowtype;
  _new_cost numeric(12,2);
begin
  if _caller is null
    or private.has_active_store_role(
      _store_id,
      array['admin', 'manager']::public.membership_role[]
    ) is not true
  then
    raise exception 'Admin or Manager access required';
  end if;
  if _quantity is null or _quantity <= 0 then
    raise exception 'Restock quantity must be positive';
  end if;
  if _purchase_unit_cost is null or _purchase_unit_cost < 0 then
    raise exception 'Purchase unit cost must be zero or greater';
  end if;
  if _notes is not null and char_length(btrim(_notes)) > 500 then
    raise exception 'Notes must be 500 characters or fewer';
  end if;

  select * into _product
  from public.products p
  where p.id = _product_id
    and p.store_id = _store_id
    and not p.is_deleted
  for update;
  if not found then
    raise exception 'Product not found in the assigned store';
  end if;

  _new_cost := case
    when _product.stock = 0 then round(_purchase_unit_cost, 2)
    else round(
      ((_product.stock * _product.buying_price) + (_quantity * _purchase_unit_cost))
      / (_product.stock + _quantity),
      2
    )
  end;

  perform set_config('sariswift.stock_change_reason', 'restock', true);
  perform set_config('sariswift.inventory_write', 'allowed', true);
  update public.products
  set stock = _product.stock + _quantity,
      buying_price = _new_cost
  where id = _product.id
    and store_id = _store_id
  returning * into _updated;
  perform set_config('sariswift.inventory_write', '', true);
  perform set_config('sariswift.stock_change_reason', '', true);

  insert into public.inventory_movements (
    store_id, product_id, movement_type, quantity_change,
    stock_before, stock_after, unit_cost, total_cost,
    reference_type, reference_id, notes, created_by
  ) values (
    _store_id, _product.id, 'restock', _quantity,
    _product.stock, _updated.stock, round(_purchase_unit_cost, 2),
    round(_quantity * _purchase_unit_cost, 2),
    'product', _product.id, nullif(btrim(_notes), ''), _caller
  );

  insert into public.audit_logs (
    store_id, user_id, action, entity_type, entity_id, old_values, new_values
  ) values (
    _store_id, _caller, 'inventory_restocked', 'product', _product.id,
    jsonb_build_object('stock', _product.stock, 'unit_cost', _product.buying_price),
    jsonb_build_object(
      'quantity_added', _quantity,
      'purchase_unit_cost', round(_purchase_unit_cost, 2),
      'stock', _updated.stock,
      'weighted_average_unit_cost', _updated.buying_price
    )
  );

  return _updated;
end;
$$;

revoke all on function public.restock_product(uuid, uuid, integer, numeric, text) from public;
revoke all on function public.restock_product(uuid, uuid, integer, numeric, text) from anon;
grant execute on function public.restock_product(uuid, uuid, integer, numeric, text) to authenticated;

create or replace function public.adjust_product_stock(
  _store_id uuid,
  _product_id uuid,
  _quantity_change integer,
  _reason text,
  _notes text default null
)
returns public.products
language plpgsql
security definer
set search_path = ''
as $$
declare
  _caller uuid := (select auth.uid());
  _product public.products%rowtype;
  _updated public.products%rowtype;
  _movement_type text;
begin
  if _caller is null
    or private.has_active_store_role(
      _store_id,
      array['admin', 'manager']::public.membership_role[]
    ) is not true
  then
    raise exception 'Admin or Manager access required';
  end if;
  if _quantity_change is null or _quantity_change = 0 then
    raise exception 'Adjustment quantity cannot be zero';
  end if;
  if _reason not in ('adjustment', 'damaged', 'expired', 'correction') then
    raise exception 'Invalid adjustment reason';
  end if;
  if _notes is not null and char_length(btrim(_notes)) > 500 then
    raise exception 'Notes must be 500 characters or fewer';
  end if;

  select * into _product
  from public.products p
  where p.id = _product_id
    and p.store_id = _store_id
    and not p.is_deleted
  for update;
  if not found then
    raise exception 'Product not found in the assigned store';
  end if;
  if _product.stock + _quantity_change < 0 then
    raise exception 'Adjustment would make stock negative';
  end if;

  _movement_type := case
    when _reason = 'damaged' then 'damaged'
    when _reason = 'expired' then 'expired'
    when _reason = 'correction' then 'correction'
    when _quantity_change > 0 then 'adjustment_in'
    else 'adjustment_out'
  end;

  perform set_config('sariswift.stock_change_reason', 'adjustment', true);
  perform set_config('sariswift.inventory_write', 'allowed', true);
  update public.products
  set stock = _product.stock + _quantity_change
  where id = _product.id
    and store_id = _store_id
  returning * into _updated;
  perform set_config('sariswift.inventory_write', '', true);
  perform set_config('sariswift.stock_change_reason', '', true);

  insert into public.inventory_movements (
    store_id, product_id, movement_type, quantity_change,
    stock_before, stock_after, unit_cost, total_cost,
    reference_type, reference_id, notes, created_by
  ) values (
    _store_id, _product.id, _movement_type, _quantity_change,
    _product.stock, _updated.stock, _product.buying_price,
    round(abs(_quantity_change) * _product.buying_price, 2),
    'product', _product.id, nullif(btrim(_notes), ''), _caller
  );

  insert into public.audit_logs (
    store_id, user_id, action, entity_type, entity_id, old_values, new_values
  ) values (
    _store_id, _caller, 'inventory_adjusted', 'product', _product.id,
    jsonb_build_object('stock', _product.stock),
    jsonb_build_object(
      'quantity_change', _quantity_change,
      'reason', _reason,
      'stock', _updated.stock
    )
  );

  return _updated;
end;
$$;

revoke all on function public.adjust_product_stock(uuid, uuid, integer, text, text) from public;
revoke all on function public.adjust_product_stock(uuid, uuid, integer, text, text) from anon;
grant execute on function public.adjust_product_stock(uuid, uuid, integer, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Product audit trigger: name the stock change instead of calling every
--    change a manual "Stock adjusted". Historical rows keep their old action.
-- ---------------------------------------------------------------------------
create or replace function private.audit_product_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _action text;
  _reason text := coalesce(current_setting('sariswift.stock_change_reason', true), '');
begin
  if tg_op = 'INSERT' then
    _action := 'product_created';
  elsif new.is_deleted and not old.is_deleted then
    _action := 'product_soft_deleted';
  elsif new.is_archived and not old.is_archived then
    _action := 'product_archived';
  elsif new.stock is distinct from old.stock then
    _action := case _reason
      when 'sale' then 'sale_stock_deducted'
      when 'restock' then 'stock_restocked'
      else 'stock_adjusted'
    end;
  else
    _action := 'product_edited';
  end if;

  insert into public.audit_logs (
    store_id,
    user_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values
  )
  values (
    new.store_id,
    (select auth.uid()),
    _action,
    'product',
    new.id,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new)
  );
  return new;
end;
$$;

revoke all on function private.audit_product_change() from public;

-- ---------------------------------------------------------------------------
-- 5. Managers keep operational visibility, including the two new action names.
--    Admin visibility is unchanged.
-- ---------------------------------------------------------------------------
drop policy if exists "Assigned roles read permitted store audit logs" on public.audit_logs;
create policy "Assigned roles read permitted store audit logs"
  on public.audit_logs for select to authenticated
  using (
    (select private.has_active_store_role(
      audit_logs.store_id,
      array['admin']::public.membership_role[]
    ))
    or (
      (select private.has_active_store_role(
        audit_logs.store_id,
        array['manager']::public.membership_role[]
      ))
      and action in (
        'product_created', 'product_edited', 'stock_adjusted',
        'sale_stock_deducted', 'stock_restocked',
        'product_archived', 'product_soft_deleted', 'sale_completed',
        'category_created', 'category_edited', 'category_archived',
        'category_restored', 'category_reordered',
        'category_products_reassigned',
        'inventory_restocked', 'inventory_adjusted'
      )
    )
  );
