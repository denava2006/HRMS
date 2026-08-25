-- Product cost, inventory capital, COGS, and profit.
-- Forward-only: this migration preserves all existing rows and records the
-- current inventory as an opening balance without changing product stock.

alter table public.sale_items
  add column unit_cost_snapshot numeric(12,2),
  add column line_cogs numeric(14,2),
  add column line_gross_profit numeric(14,2),
  add column cost_snapshot_source text
    check (cost_snapshot_source in ('trusted_checkout', 'legacy_implied'));

comment on column public.sale_items.unit_cost_snapshot is
  'Trusted unit cost at checkout. Legacy rows are backfilled from unit_price - unit_profit.';
comment on column public.sale_items.cost_snapshot_source is
  'legacy_implied identifies estimates reconstructed from the pre-migration profit fields.';

update public.sale_items
set unit_cost_snapshot = greatest(round(unit_price - unit_profit, 2), 0),
    line_cogs = greatest(round(line_total - line_profit, 2), 0),
    line_gross_profit = round(line_profit, 2),
    cost_snapshot_source = 'legacy_implied'
where unit_cost_snapshot is null;

do $$
begin
  if exists (
    select 1
    from public.sale_items
    where unit_cost_snapshot is null
       or line_cogs is null
       or line_gross_profit is null
       or cost_snapshot_source is null
  ) then
    raise exception 'Historical sale-item cost backfill verification failed';
  end if;
end;
$$;

alter table public.sale_items
  alter column unit_cost_snapshot set not null,
  alter column line_cogs set not null,
  alter column line_gross_profit set not null,
  alter column cost_snapshot_source set not null,
  add constraint sale_items_unit_cost_snapshot_nonnegative
    check (unit_cost_snapshot >= 0),
  add constraint sale_items_line_cogs_nonnegative
    check (line_cogs >= 0);

alter table public.sales
  add column gross_sales numeric(14,2),
  add column net_sales numeric(14,2),
  add column total_cogs numeric(14,2),
  add column gross_profit numeric(14,2),
  add column store_paid_deductions numeric(14,2),
  add column net_profit numeric(14,2);

with item_totals as (
  select
    si.sale_id,
    coalesce(sum(si.line_total), 0)::numeric(14,2) as item_revenue,
    coalesce(sum(si.line_cogs), 0)::numeric(14,2) as cogs,
    coalesce(sum(si.line_gross_profit), 0)::numeric(14,2) as profit
  from public.sale_items si
  group by si.sale_id
)
update public.sales s
set gross_sales = coalesce(s.subtotal, it.item_revenue, 0),
    net_sales = coalesce(s.subtotal, it.item_revenue, 0),
    total_cogs = coalesce(it.cogs, 0),
    gross_profit = coalesce(it.profit, s.total_profit, 0),
    store_paid_deductions = 0,
    net_profit = coalesce(it.profit, s.total_profit, 0)
from item_totals it
where it.sale_id = s.id;

update public.sales
set gross_sales = coalesce(gross_sales, subtotal, 0),
    net_sales = coalesce(net_sales, subtotal, 0),
    total_cogs = coalesce(total_cogs, 0),
    gross_profit = coalesce(gross_profit, total_profit, 0),
    store_paid_deductions = coalesce(store_paid_deductions, 0),
    net_profit = coalesce(net_profit, total_profit, 0)
where gross_sales is null
   or net_sales is null
   or total_cogs is null
   or gross_profit is null
   or store_paid_deductions is null
   or net_profit is null;

alter table public.sales
  alter column gross_sales set default 0,
  alter column gross_sales set not null,
  alter column net_sales set default 0,
  alter column net_sales set not null,
  alter column total_cogs set default 0,
  alter column total_cogs set not null,
  alter column gross_profit set default 0,
  alter column gross_profit set not null,
  alter column store_paid_deductions set default 0,
  alter column store_paid_deductions set not null,
  alter column net_profit set default 0,
  alter column net_profit set not null;

alter table public.sales
  add constraint sales_financial_totals_nonnegative
  check (
    gross_sales >= 0
    and net_sales >= 0
    and total_cogs >= 0
    and store_paid_deductions >= 0
  );

-- The earlier index omitted store_id. Existing uniqueness is stricter, so
-- replacing it with the intended store/user/key scope cannot lose sales.
drop index if exists public.sales_created_by_checkout_key_idx;
create unique index sales_store_created_by_checkout_key_idx
  on public.sales(store_id, created_by, checkout_key)
  where checkout_key is not null;

alter table public.products
  add constraint products_id_store_unique unique (id, store_id);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  product_id uuid not null,
  movement_type text not null check (
    movement_type in (
      'initial_stock', 'restock', 'adjustment_in', 'adjustment_out',
      'sale', 'refund', 'return', 'damaged', 'expired', 'correction'
    )
  ),
  quantity_change integer not null,
  stock_before integer not null check (stock_before >= 0),
  stock_after integer not null check (stock_after >= 0),
  unit_cost numeric(12,2) not null check (unit_cost >= 0),
  total_cost numeric(14,2) not null check (total_cost >= 0),
  reference_type text,
  reference_id uuid,
  notes text check (notes is null or char_length(notes) <= 500),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint inventory_movements_stock_math check (
    stock_after = stock_before + quantity_change
  ),
  constraint inventory_movements_product_store_fk
    foreign key (product_id, store_id)
    references public.products(id, store_id)
    on update restrict
    on delete restrict
);

create index inventory_movements_store_created_idx
  on public.inventory_movements(store_id, created_at desc);
create index inventory_movements_product_created_idx
  on public.inventory_movements(product_id, created_at desc);
create index inventory_movements_reference_idx
  on public.inventory_movements(reference_type, reference_id)
  where reference_id is not null;

alter table public.inventory_movements enable row level security;

create policy "Inventory roles read store movements"
  on public.inventory_movements for select to authenticated
  using (
    (select private.has_active_store_role(
      inventory_movements.store_id,
      array['admin', 'manager']::public.membership_role[]
    ))
  );

revoke all privileges on table public.inventory_movements from anon;
revoke all privileges on table public.inventory_movements from authenticated;
grant select on table public.inventory_movements to authenticated;
grant select, insert, update, delete on table public.inventory_movements to service_role;

-- Opening rows describe the migration-time balance. They do not alter stock and
-- are not purchases, so existing inventory is not double-counted.
insert into public.inventory_movements (
  store_id,
  product_id,
  movement_type,
  quantity_change,
  stock_before,
  stock_after,
  unit_cost,
  total_cost,
  reference_type,
  reference_id,
  notes,
  created_by,
  created_at
)
select
  p.store_id,
  p.id,
  'initial_stock',
  p.stock,
  0,
  p.stock,
  p.buying_price,
  round(p.stock * p.buying_price, 2),
  'migration_opening_balance',
  p.id,
  'Opening balance captured when cost accounting was enabled',
  null,
  now()
from public.products p;

create or replace function private.guard_product_inventory_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.stock is distinct from old.stock
    and coalesce(current_setting('sariswift.inventory_write', true), '') <> 'allowed'
  then
    raise exception 'Use the secure inventory operation for stock changes';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_product_inventory_write() from public;

create trigger guard_product_inventory_write
  before update of stock on public.products
  for each row execute function private.guard_product_inventory_write();

create or replace function private.record_new_product_inventory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.inventory_movements (
    store_id, product_id, movement_type, quantity_change,
    stock_before, stock_after, unit_cost, total_cost,
    reference_type, reference_id, notes, created_by
  ) values (
    new.store_id, new.id, 'initial_stock', new.stock,
    0, new.stock, new.buying_price, round(new.stock * new.buying_price, 2),
    'product', new.id, 'Initial stock entered when the product was created',
    (select auth.uid())
  );
  return new;
end;
$$;

revoke all on function private.record_new_product_inventory() from public;

create trigger record_new_product_inventory
  after insert on public.products
  for each row execute function private.record_new_product_inventory();

create or replace function private.record_product_cost_revaluation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.buying_price is distinct from old.buying_price
    and coalesce(current_setting('sariswift.inventory_write', true), '') <> 'allowed'
  then
    insert into public.inventory_movements (
      store_id, product_id, movement_type, quantity_change,
      stock_before, stock_after, unit_cost, total_cost,
      reference_type, reference_id, notes, created_by
    ) values (
      new.store_id, new.id, 'correction', 0,
      new.stock, new.stock, new.buying_price,
      round(abs(new.buying_price - old.buying_price) * new.stock, 2),
      'cost_revaluation', new.id,
      format('Unit cost changed from %s to %s', old.buying_price, new.buying_price),
      (select auth.uid())
    );
  end if;
  return new;
end;
$$;

revoke all on function private.record_product_cost_revaluation() from public;

create trigger record_product_cost_revaluation
  after update of buying_price on public.products
  for each row execute function private.record_product_cost_revaluation();

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

  perform set_config('sariswift.inventory_write', 'allowed', true);
  update public.products
  set stock = _product.stock + _quantity,
      buying_price = _new_cost
  where id = _product.id
    and store_id = _store_id
  returning * into _updated;

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

  perform set_config('sariswift.inventory_write', 'allowed', true);
  update public.products
  set stock = _product.stock + _quantity_change
  where id = _product.id
    and store_id = _store_id
  returning * into _updated;

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
grant execute on function public.adjust_product_stock(uuid, uuid, integer, text, text) to authenticated;

create or replace function public.secure_checkout(
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
  _store public.stores%rowtype;
  _item jsonb;
  _fee jsonb;
  _product public.products%rowtype;
  _sale public.sales%rowtype;
  _product_id uuid;
  _quantity integer;
  _stock_before integer;
  _seen uuid[] := array[]::uuid[];
  _gross_sales numeric(14,2) := 0;
  _cogs numeric(14,2) := 0;
  _gross_profit numeric(14,2) := 0;
  _fees_total numeric(14,2) := 0;
  _fee_amount numeric(14,2);
  _applied_fees jsonb := '[]'::jsonb;
begin
  if _caller is null then raise exception 'Authentication required'; end if;

  select sm.role into _role
  from public.store_memberships sm
  where sm.store_id = _store_id
    and sm.user_id = _caller
    and sm.status = 'active';
  if _role is null or _role not in ('admin', 'manager', 'cashier') then
    raise exception 'Active store membership required';
  end if;
  if _checkout_key is null then
    raise exception 'Checkout key is required';
  end if;

  -- Serialize retries for the exact store/user/key before checking for an
  -- existing sale. A concurrent retry waits, then returns the committed sale.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      _store_id::text || ':' || _caller::text || ':' || _checkout_key::text,
      0
    )
  );

  if _items is null or jsonb_typeof(_items) <> 'array'
    or jsonb_array_length(_items) = 0 or jsonb_array_length(_items) > 100
  then raise exception 'Cart must contain between 1 and 100 items'; end if;
  if _payment_method is null
    or _payment_method not in ('cash', 'gcash', 'maya', 'bank', 'other')
  then raise exception 'Invalid payment method'; end if;
  if _payment_method = 'cash' and (_amount_tendered is null or _amount_tendered < 0)
  then raise exception 'Valid cash tender is required'; end if;
  if _payment_method <> 'cash'
    and nullif(btrim(coalesce(_payment_reference, '')), '') is null
  then raise exception 'Payment reference is required'; end if;

  select * into _sale
  from public.sales s
  where s.store_id = _store_id
    and s.created_by = _caller
    and s.checkout_key = _checkout_key;
  if found then
    return jsonb_build_object(
      'id', _sale.id, 'created_at', _sale.created_at,
      'subtotal', _sale.subtotal, 'fees', _sale.fees,
      'total_amount', _sale.total_amount, 'gross_sales', _sale.gross_sales,
      'net_sales', _sale.net_sales, 'total_cogs', _sale.total_cogs,
      'gross_profit', _sale.gross_profit, 'net_profit', _sale.net_profit,
      'total_profit', _sale.total_profit, 'created_by', _sale.created_by
    );
  end if;

  select * into _store from public.stores s where s.id = _store_id;
  if not found then raise exception 'Store not found'; end if;

  begin
    perform 1
    from public.products p
    where p.store_id = _store_id
      and p.id in (
      select (value->>'product_id')::uuid from jsonb_array_elements(_items)
    )
    order by p.id
    for update;
  exception when others then
    raise exception 'Every cart item needs a valid product and quantity';
  end;

  for _item in select value from jsonb_array_elements(_items)
  loop
    begin
      _product_id := (_item->>'product_id')::uuid;
      _quantity := (_item->>'quantity')::integer;
    exception when others then
      raise exception 'Every cart item needs a valid product and quantity';
    end;
    if _quantity is null or _quantity <= 0 then
      raise exception 'Item quantity must be positive';
    end if;
    if _product_id = any (_seen) then
      raise exception 'Duplicate products are not allowed in one checkout';
    end if;
    _seen := array_append(_seen, _product_id);

    select * into _product
    from public.products p
    where p.id = _product_id and p.store_id = _store_id
      and not p.is_deleted and not p.is_archived
    for update;
    if not found then raise exception 'Product is unavailable'; end if;
    if _product.stock < _quantity then
      raise exception 'Insufficient stock for %', _product.name;
    end if;

    _gross_sales := _gross_sales + round(_product.selling_price * _quantity, 2);
    _cogs := _cogs + round(_product.buying_price * _quantity, 2);
    _gross_profit := _gross_profit
      + round((_product.selling_price - _product.buying_price) * _quantity, 2);
  end loop;

  for _fee in select value from jsonb_array_elements(coalesce(_store.fees, '[]'::jsonb))
  loop
    if coalesce((_fee->>'enabled')::boolean, false)
      and coalesce((_fee->>'value')::numeric, 0) > 0
      and (_fee->>'type') in ('percent', 'fixed')
    then
      _fee_amount := case
        when (_fee->>'type') = 'percent'
          then round(_gross_sales * ((_fee->>'value')::numeric / 100), 2)
        else round((_fee->>'value')::numeric, 2)
      end;
      _fees_total := _fees_total + _fee_amount;
      _applied_fees := _applied_fees || jsonb_build_array(jsonb_build_object(
        'name', coalesce(nullif(btrim(_fee->>'name'), ''), 'Fee'),
        'type', _fee->>'type', 'value', (_fee->>'value')::numeric,
        'amount', _fee_amount, 'paid_by', 'customer'
      ));
    end if;
  end loop;

  if _payment_method = 'cash' and _amount_tendered < (_gross_sales + _fees_total)
  then raise exception 'Cash received is less than total'; end if;

  insert into public.sales (
    total_amount, total_profit, payment_method, payment_reference,
    amount_tendered, fees, subtotal, store_id, created_by, checkout_key,
    gross_sales, net_sales, total_cogs, gross_profit,
    store_paid_deductions, net_profit
  ) values (
    _gross_sales + _fees_total, _gross_profit, _payment_method,
    case when _payment_method = 'cash' then null else btrim(_payment_reference) end,
    case when _payment_method = 'cash' then _amount_tendered else null end,
    _applied_fees, _gross_sales, _store_id, _caller, _checkout_key,
    _gross_sales, _gross_sales, _cogs, _gross_profit, 0, _gross_profit
  )
  returning * into _sale;

  perform set_config('sariswift.inventory_write', 'allowed', true);
  for _item in select value from jsonb_array_elements(_items)
  loop
    _product_id := (_item->>'product_id')::uuid;
    _quantity := (_item->>'quantity')::integer;
    select * into _product
    from public.products p
    where p.id = _product_id
      and p.store_id = _store_id
    for update;
    _stock_before := _product.stock;

    insert into public.sale_items (
      sale_id, product_id, product_name, quantity, unit_price, unit_profit,
      line_total, line_profit, unit_cost_snapshot, line_cogs,
      line_gross_profit, cost_snapshot_source
    ) values (
      _sale.id, _product.id, _product.name, _quantity,
      _product.selling_price, _product.selling_price - _product.buying_price,
      round(_product.selling_price * _quantity, 2),
      round((_product.selling_price - _product.buying_price) * _quantity, 2),
      _product.buying_price, round(_product.buying_price * _quantity, 2),
      round((_product.selling_price - _product.buying_price) * _quantity, 2),
      'trusted_checkout'
    );

    update public.products
    set stock = stock - _quantity
    where id = _product.id and store_id = _store_id and stock >= _quantity;
    if not found then raise exception 'Stock changed during checkout'; end if;

    insert into public.inventory_movements (
      store_id, product_id, movement_type, quantity_change,
      stock_before, stock_after, unit_cost, total_cost,
      reference_type, reference_id, notes, created_by
    ) values (
      _store_id, _product.id, 'sale', -_quantity,
      _stock_before, _stock_before - _quantity, _product.buying_price,
      round(_product.buying_price * _quantity, 2),
      'sale', _sale.id, null, _caller
    );
  end loop;

  insert into public.audit_logs (
    store_id, user_id, action, entity_type, entity_id, new_values
  ) values (
    _store_id, _caller, 'sale_completed', 'sale', _sale.id,
    jsonb_build_object(
      'total_amount', _sale.total_amount,
      'gross_sales', _sale.gross_sales,
      'total_cogs', _sale.total_cogs,
      'gross_profit', _sale.gross_profit,
      'net_profit', _sale.net_profit,
      'payment_method', _sale.payment_method,
      'item_count', jsonb_array_length(_items)
    )
  );

  return jsonb_build_object(
    'id', _sale.id, 'created_at', _sale.created_at,
    'subtotal', _sale.subtotal, 'fees', _sale.fees,
    'total_amount', _sale.total_amount, 'gross_sales', _sale.gross_sales,
    'net_sales', _sale.net_sales, 'total_cogs', _sale.total_cogs,
    'gross_profit', _sale.gross_profit, 'net_profit', _sale.net_profit,
    'total_profit', _sale.total_profit, 'created_by', _sale.created_by
  );
end;
$$;

revoke all on function public.secure_checkout(uuid, jsonb, text, text, numeric, uuid) from public;
revoke all on function public.secure_checkout(uuid, jsonb, text, text, numeric, uuid) from authenticated;

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
begin
  if _caller is null then raise exception 'Authentication required'; end if;
  select sm.role into _role
  from public.store_memberships sm
  where sm.store_id = _store_id
    and sm.user_id = _caller
    and sm.status = 'active';
  if _role is null then raise exception 'Active store membership required'; end if;

  _result := public.secure_checkout(
    _store_id, _items, _payment_method, _payment_reference,
    _amount_tendered, _checkout_key
  );
  if _role = 'cashier' then
    return _result
      - 'total_profit' - 'total_cogs' - 'gross_profit' - 'net_profit';
  end if;
  return _result;
end;
$$;

revoke all on function public.checkout_sale(uuid, jsonb, text, text, numeric, uuid) from public;
grant execute on function public.checkout_sale(uuid, jsonb, text, text, numeric, uuid) to authenticated;

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
        'product_archived', 'product_soft_deleted', 'sale_completed',
        'category_created', 'category_edited', 'category_archived',
        'category_restored', 'category_reordered',
        'category_products_reassigned',
        'inventory_restocked', 'inventory_adjusted'
      )
    )
  );

do $$
begin
  if exists (
    select 1
    from public.sale_items
    where unit_cost_snapshot is null
       or line_cogs is null
       or line_gross_profit is null
       or cost_snapshot_source is null
  ) then
    raise exception 'Historical sale-item cost backfill verification failed';
  end if;
  if exists (
    select 1
    from public.inventory_movements im
    join public.products p on p.id = im.product_id
    where im.store_id <> p.store_id
  ) then
    raise exception 'Cross-store inventory movement verification failed';
  end if;
end;
$$;
