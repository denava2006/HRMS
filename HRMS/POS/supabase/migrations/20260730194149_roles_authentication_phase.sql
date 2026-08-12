-- Roles and authentication phase.
-- Forward-only: preserves the applied offline baseline and all existing data.

create type public.membership_role as enum ('admin', 'manager', 'cashier');
create type public.membership_status as enum ('active', 'inactive');

create table public.store_memberships (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.membership_role not null,
  status public.membership_status not null default 'active',
  display_name text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, user_id)
);

create index store_memberships_store_id_idx on public.store_memberships(store_id);
create index store_memberships_user_id_idx on public.store_memberships(user_id);
create index store_memberships_role_idx on public.store_memberships(role);
create index store_memberships_status_idx on public.store_memberships(status);
create index store_memberships_active_user_idx
  on public.store_memberships(user_id, store_id)
  where status = 'active';

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_store_created_idx on public.audit_logs(store_id, created_at desc);
create index audit_logs_user_id_idx on public.audit_logs(user_id);
create index audit_logs_action_idx on public.audit_logs(action);

alter table public.sales
  add column created_by uuid references auth.users(id) on delete set null,
  add column checkout_key uuid;

create unique index sales_created_by_checkout_key_idx
  on public.sales(created_by, checkout_key)
  where checkout_key is not null;
create index sales_created_by_idx on public.sales(created_by);

alter table public.store_memberships enable row level security;
alter table public.audit_logs enable row level security;

create trigger store_memberships_updated_at
  before update on public.store_memberships
  for each row execute function public.update_updated_at();

-- Existing store owners become active Admins of only their existing stores.
-- ON CONFLICT makes this safe to run once per migration replay without duplicates.
insert into public.store_memberships (
  store_id,
  user_id,
  role,
  status,
  display_name,
  created_by
)
select
  s.id,
  s.owner_id,
  'admin'::public.membership_role,
  'active'::public.membership_status,
  nullif(trim(s.owner_name), ''),
  s.owner_id
from public.stores s
on conflict (store_id, user_id) do nothing;

do $$
begin
  if exists (
    select 1
    from public.stores s
    where not exists (
      select 1
      from public.store_memberships sm
      where sm.store_id = s.id
        and sm.user_id = s.owner_id
        and sm.role = 'admin'
        and sm.status = 'active'
    )
  ) then
    raise exception 'Owner-to-Admin membership backfill verification failed';
  end if;
end;
$$;

-- New Auth users must receive access only through Admin staff management or
-- the local-only demo seed. The legacy enum and rows remain for compatibility,
-- but are no longer consulted by active authorization.
drop trigger if exists on_auth_user_created on auth.users;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.has_active_store_role(
  _store_id uuid,
  _roles public.membership_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = _store_id
      and sm.user_id = (select auth.uid())
      and sm.status = 'active'
      and sm.role = any (_roles)
  );
$$;

revoke all on function private.has_active_store_role(uuid, public.membership_role[]) from public;
grant execute on function private.has_active_store_role(uuid, public.membership_role[]) to authenticated;

create or replace function private.active_store_role(_store_id uuid)
returns public.membership_role
language sql
stable
security definer
set search_path = ''
as $$
  select sm.role
  from public.store_memberships sm
  where sm.store_id = _store_id
    and sm.user_id = (select auth.uid())
    and sm.status = 'active'
  limit 1;
$$;

revoke all on function private.active_store_role(uuid) from public;
grant execute on function private.active_store_role(uuid) to authenticated;

-- Replace owner/global-admin policies with active, explicitly assigned,
-- store-scoped membership policies.
drop policy if exists "Users view own roles" on public.user_roles;
drop policy if exists "Admins manage roles" on public.user_roles;
drop policy if exists "Owners and admins view stores" on public.stores;
drop policy if exists "Owners create stores" on public.stores;
drop policy if exists "Owners and admins update stores" on public.stores;
drop policy if exists "Owners and admins delete stores" on public.stores;
drop policy if exists "Store owners and admins read products" on public.products;
drop policy if exists "Store owners insert products" on public.products;
drop policy if exists "Store owners update products" on public.products;
drop policy if exists "Store owners delete products" on public.products;
drop policy if exists "Store owners and admins read sales" on public.sales;
drop policy if exists "Store owners insert sales" on public.sales;
drop policy if exists "Store owners and admins read sale items" on public.sale_items;
drop policy if exists "Store owners insert sale items" on public.sale_items;

create policy "Users read their legacy role rows"
  on public.user_roles for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Members read assigned stores"
  on public.stores for select to authenticated
  using (
    (select private.has_active_store_role(
      stores.id,
      array['admin', 'manager']::public.membership_role[]
    ))
  );

create policy "Admins update assigned stores"
  on public.stores for update to authenticated
  using (
    (select private.has_active_store_role(
      stores.id,
      array['admin']::public.membership_role[]
    ))
  )
  with check (
    (select private.has_active_store_role(
      stores.id,
      array['admin']::public.membership_role[]
    ))
  );

create policy "Admins delete assigned stores"
  on public.stores for delete to authenticated
  using (
    (select private.has_active_store_role(
      stores.id,
      array['admin']::public.membership_role[]
    ))
  );

create policy "Inventory roles read products"
  on public.products for select to authenticated
  using (
    (select private.has_active_store_role(
      products.store_id,
      array['admin', 'manager']::public.membership_role[]
    ))
  );

create policy "Inventory roles insert products"
  on public.products for insert to authenticated
  with check (
    (select private.has_active_store_role(
      products.store_id,
      array['admin', 'manager']::public.membership_role[]
    ))
  );

create policy "Inventory roles update products"
  on public.products for update to authenticated
  using (
    (select private.has_active_store_role(
      products.store_id,
      array['admin', 'manager']::public.membership_role[]
    ))
  )
  with check (
    (select private.has_active_store_role(
      products.store_id,
      array['admin', 'manager']::public.membership_role[]
    ))
  );

create policy "Admins soft delete products"
  on public.products for delete to authenticated
  using (
    (select private.has_active_store_role(
      products.store_id,
      array['admin']::public.membership_role[]
    ))
  );

create policy "Reporting roles read store sales"
  on public.sales for select to authenticated
  using (
    (select private.has_active_store_role(
      sales.store_id,
      array['admin', 'manager']::public.membership_role[]
    ))
  );

create policy "Reporting roles read store sale items"
  on public.sale_items for select to authenticated
  using (
    exists (
      select 1
      from public.sales s
      where s.id = sale_items.sale_id
        and (select private.has_active_store_role(
          s.store_id,
          array['admin', 'manager']::public.membership_role[]
        ))
    )
  );

create policy "Members read own membership and operational roles read staff"
  on public.store_memberships for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.has_active_store_role(
      store_memberships.store_id,
      array['admin', 'manager']::public.membership_role[]
    ))
  );

create policy "Admins read all store audit logs"
  on public.audit_logs for select to authenticated
  using (
    (select private.has_active_store_role(
      audit_logs.store_id,
      array['admin']::public.membership_role[]
    ))
  );

create policy "Managers read operational store audit logs"
  on public.audit_logs for select to authenticated
  using (
    (select private.has_active_store_role(
      audit_logs.store_id,
      array['manager']::public.membership_role[]
    ))
    and action in (
      'product_created',
      'product_edited',
      'stock_adjusted',
      'product_archived',
      'product_soft_deleted',
      'sale_completed'
    )
  );

-- Cashiers use safe RPCs that intentionally omit buying prices and profit.
create or replace function public.get_pos_products(_store_id uuid)
returns table (
  id uuid,
  name text,
  category text,
  stock integer,
  selling_price numeric,
  image_url text,
  is_deleted boolean,
  store_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.name,
    p.category,
    p.stock,
    p.selling_price,
    p.image_url,
    p.is_deleted,
    p.store_id
  from public.products p
  where p.store_id = _store_id
    and not p.is_deleted
    and exists (
      select 1
      from public.store_memberships sm
      where sm.store_id = _store_id
        and sm.user_id = (select auth.uid())
        and sm.status = 'active'
        and sm.role in ('admin', 'manager', 'cashier')
    )
  order by p.name;
$$;

revoke all on function public.get_pos_products(uuid) from public;
grant execute on function public.get_pos_products(uuid) to authenticated;

create or replace function public.get_pos_store(_store_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'currency', s.currency,
    'fees', s.fees,
    'payment_qr_url', s.payment_qr_url
  )
  from public.stores s
  where s.id = _store_id
    and exists (
      select 1
      from public.store_memberships sm
      where sm.store_id = s.id
        and sm.user_id = (select auth.uid())
        and sm.status = 'active'
        and sm.role = 'cashier'
    );
$$;

revoke all on function public.get_pos_store(uuid) from public;
grant execute on function public.get_pos_store(uuid) to authenticated;

create or replace function public.get_my_transactions(
  _store_id uuid,
  _start_at timestamptz,
  _end_at timestamptz,
  _limit_count integer default 200
)
returns table (
  id uuid,
  total_amount numeric,
  created_at timestamptz,
  payment_method text,
  payment_reference text,
  amount_tendered numeric,
  fees jsonb,
  subtotal numeric,
  sale_items jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.total_amount,
    s.created_at,
    s.payment_method,
    s.payment_reference,
    s.amount_tendered,
    s.fees,
    s.subtotal,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', si.id,
          'product_name', si.product_name,
          'quantity', si.quantity,
          'unit_price', si.unit_price,
          'line_total', si.line_total
        )
        order by si.created_at
      ) filter (where si.id is not null),
      '[]'::jsonb
    ) as sale_items
  from public.sales s
  left join public.sale_items si on si.sale_id = s.id
  where s.store_id = _store_id
    and s.created_by = (select auth.uid())
    and s.created_at >= _start_at
    and s.created_at <= _end_at
    and exists (
      select 1
      from public.store_memberships sm
      where sm.store_id = s.store_id
        and sm.user_id = (select auth.uid())
        and sm.status = 'active'
        and sm.role = 'cashier'
    )
  group by s.id
  order by s.created_at desc
  limit greatest(1, least(coalesce(_limit_count, 200), 200));
$$;

revoke all on function public.get_my_transactions(uuid, timestamptz, timestamptz, integer) from public;
grant execute on function public.get_my_transactions(uuid, timestamptz, timestamptz, integer) to authenticated;

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
  _seen uuid[] := array[]::uuid[];
  _subtotal numeric(12,2) := 0;
  _profit numeric(12,2) := 0;
  _fees_total numeric(12,2) := 0;
  _fee_amount numeric(12,2);
  _applied_fees jsonb := '[]'::jsonb;
begin
  if _caller is null then
    raise exception 'Authentication required';
  end if;

  select sm.role into _role
  from public.store_memberships sm
  where sm.store_id = _store_id
    and sm.user_id = _caller
    and sm.status = 'active';

  if _role is null or _role not in ('admin', 'manager', 'cashier') then
    raise exception 'Active store membership required';
  end if;

  if _items is null
    or jsonb_typeof(_items) <> 'array'
    or jsonb_array_length(_items) = 0
    or jsonb_array_length(_items) > 100 then
    raise exception 'Cart must contain between 1 and 100 items';
  end if;

  if _payment_method not in ('cash', 'gcash', 'maya', 'bank', 'other') then
    raise exception 'Invalid payment method';
  end if;

  if _payment_method = 'cash' and (_amount_tendered is null or _amount_tendered < 0) then
    raise exception 'Valid cash tender is required';
  end if;

  if _payment_method <> 'cash' and nullif(trim(coalesce(_payment_reference, '')), '') is null then
    raise exception 'Payment reference is required';
  end if;

  if _checkout_key is not null then
    select * into _sale
    from public.sales s
    where s.created_by = _caller
      and s.checkout_key = _checkout_key;

    if found then
      return jsonb_build_object(
        'id', _sale.id,
        'created_at', _sale.created_at,
        'subtotal', _sale.subtotal,
        'fees', _sale.fees,
        'total_amount', _sale.total_amount,
        'total_profit', _sale.total_profit,
        'created_by', _sale.created_by
      );
    end if;
  end if;

  select * into _store
  from public.stores s
  where s.id = _store_id;

  if not found then
    raise exception 'Store not found';
  end if;

  -- Lock all requested product rows in stable order before validating totals.
  perform 1
  from public.products p
  where p.id in (
    select (value->>'product_id')::uuid
    from jsonb_array_elements(_items)
  )
  order by p.id
  for update;

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
    where p.id = _product_id
      and p.store_id = _store_id
      and not p.is_deleted
    for update;

    if not found then
      raise exception 'Product is unavailable';
    end if;
    if _product.stock < _quantity then
      raise exception 'Insufficient stock for %', _product.name;
    end if;

    _subtotal := _subtotal + (_product.selling_price * _quantity);
    _profit := _profit + ((_product.selling_price - _product.buying_price) * _quantity);
  end loop;

  for _fee in
    select value
    from jsonb_array_elements(coalesce(_store.fees, '[]'::jsonb))
  loop
    if coalesce((_fee->>'enabled')::boolean, false)
      and coalesce((_fee->>'value')::numeric, 0) > 0
      and (_fee->>'type') in ('percent', 'fixed') then
      _fee_amount := case
        when (_fee->>'type') = 'percent'
          then round(_subtotal * ((_fee->>'value')::numeric / 100), 2)
        else round((_fee->>'value')::numeric, 2)
      end;
      _fees_total := _fees_total + _fee_amount;
      _applied_fees := _applied_fees || jsonb_build_array(jsonb_build_object(
        'name', coalesce(nullif(trim(_fee->>'name'), ''), 'Fee'),
        'type', _fee->>'type',
        'value', (_fee->>'value')::numeric,
        'amount', _fee_amount
      ));
    end if;
  end loop;

  if _payment_method = 'cash' and _amount_tendered < (_subtotal + _fees_total) then
    raise exception 'Cash received is less than total';
  end if;

  insert into public.sales (
    total_amount,
    total_profit,
    payment_method,
    payment_reference,
    amount_tendered,
    fees,
    subtotal,
    store_id,
    created_by,
    checkout_key
  )
  values (
    _subtotal + _fees_total,
    _profit,
    _payment_method,
    case when _payment_method = 'cash' then null else trim(_payment_reference) end,
    case when _payment_method = 'cash' then _amount_tendered else null end,
    _applied_fees,
    _subtotal,
    _store_id,
    _caller,
    _checkout_key
  )
  returning * into _sale;

  for _item in select value from jsonb_array_elements(_items)
  loop
    _product_id := (_item->>'product_id')::uuid;
    _quantity := (_item->>'quantity')::integer;

    select * into _product
    from public.products p
    where p.id = _product_id
    for update;

    insert into public.sale_items (
      sale_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      unit_profit,
      line_total,
      line_profit
    )
    values (
      _sale.id,
      _product.id,
      _product.name,
      _quantity,
      _product.selling_price,
      _product.selling_price - _product.buying_price,
      _product.selling_price * _quantity,
      (_product.selling_price - _product.buying_price) * _quantity
    );

    update public.products
    set stock = stock - _quantity
    where id = _product.id
      and store_id = _store_id
      and stock >= _quantity;

    if not found then
      raise exception 'Stock changed during checkout';
    end if;
  end loop;

  insert into public.audit_logs (
    store_id,
    user_id,
    action,
    entity_type,
    entity_id,
    new_values
  )
  values (
    _store_id,
    _caller,
    'sale_completed',
    'sale',
    _sale.id,
    jsonb_build_object(
      'total_amount', _sale.total_amount,
      'payment_method', _sale.payment_method,
      'item_count', jsonb_array_length(_items)
    )
  );

  return jsonb_build_object(
    'id', _sale.id,
    'created_at', _sale.created_at,
    'subtotal', _sale.subtotal,
    'fees', _sale.fees,
    'total_amount', _sale.total_amount,
    'total_profit', _sale.total_profit,
    'created_by', _sale.created_by
  );
end;
$$;

revoke all on function public.secure_checkout(uuid, jsonb, text, text, numeric, uuid) from public;
grant execute on function public.secure_checkout(uuid, jsonb, text, text, numeric, uuid) to authenticated;

create or replace function private.audit_product_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _action text;
begin
  if tg_op = 'INSERT' then
    _action := 'product_created';
  elsif new.is_deleted and not old.is_deleted then
    _action := 'product_soft_deleted';
  elsif new.is_archived and not old.is_archived then
    _action := 'product_archived';
  elsif new.stock is distinct from old.stock then
    _action := 'stock_adjusted';
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

create trigger audit_product_changes
  after insert or update on public.products
  for each row execute function private.audit_product_change();

create or replace function private.audit_store_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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
    new.id,
    (select auth.uid()),
    'settings_changed',
    'store',
    new.id,
    to_jsonb(old),
    to_jsonb(new)
  );
  return new;
end;
$$;

revoke all on function private.audit_store_change() from public;

create trigger audit_store_changes
  after update on public.stores
  for each row execute function private.audit_store_change();

-- Remove broad inherited/default privileges, then expose only required Data API
-- operations. RLS remains the row-level security boundary.
revoke all privileges on table
  public.user_roles,
  public.stores,
  public.products,
  public.sales,
  public.sale_items,
  public.store_memberships,
  public.audit_logs
from anon;

revoke truncate, trigger, references on table
  public.user_roles,
  public.stores,
  public.products,
  public.sales,
  public.sale_items,
  public.store_memberships,
  public.audit_logs
from authenticated;

revoke all privileges on table
  public.user_roles,
  public.stores,
  public.products,
  public.sales,
  public.sale_items,
  public.store_memberships,
  public.audit_logs
from authenticated;

grant select on table public.user_roles to authenticated;
grant select, update, delete on table public.stores to authenticated;
grant select, insert, update, delete on table public.products to authenticated;
grant select on table public.sales to authenticated;
grant select on table public.sale_items to authenticated;
grant select on table public.store_memberships to authenticated;
grant select on table public.audit_logs to authenticated;
grant select, insert on table public.stores to service_role;
grant select, insert, update, delete on table public.store_memberships to service_role;
grant select, insert on table public.audit_logs to service_role;

-- The old helper remains only for legacy compatibility and is no longer used
-- in active policies. Prevent arbitrary authenticated role probing.
revoke execute on function public.has_role(uuid, public.app_role) from authenticated;

create or replace function private.try_uuid(_value text)
returns uuid
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  return _value::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

revoke all on function private.try_uuid(text) from public;
grant execute on function private.try_uuid(text) to authenticated;

drop policy if exists "Authenticated upload product images" on storage.objects;
drop policy if exists "Owners update product images" on storage.objects;
drop policy if exists "Owners delete product images" on storage.objects;

create policy "Inventory roles upload store images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and owner_id = (select auth.uid()::text)
    and (
      (
        (select private.try_uuid((storage.foldername(name))[1])) is not null
        and (select private.has_active_store_role(
          (select private.try_uuid((storage.foldername(name))[1])),
          array['admin', 'manager']::public.membership_role[]
        ))
      )
      or (
        (storage.foldername(name))[1] = 'qr'
        and (select private.try_uuid((storage.foldername(name))[2])) is not null
        and (select private.has_active_store_role(
          (select private.try_uuid((storage.foldername(name))[2])),
          array['admin']::public.membership_role[]
        ))
      )
    )
  );

create policy "Store image owners update allowed images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'product-images'
    and owner_id = (select auth.uid()::text)
    and (
      (
        (select private.try_uuid((storage.foldername(name))[1])) is not null
        and (select private.has_active_store_role(
          (select private.try_uuid((storage.foldername(name))[1])),
          array['admin', 'manager']::public.membership_role[]
        ))
      )
      or (
        (storage.foldername(name))[1] = 'qr'
        and (select private.try_uuid((storage.foldername(name))[2])) is not null
        and (select private.has_active_store_role(
          (select private.try_uuid((storage.foldername(name))[2])),
          array['admin']::public.membership_role[]
        ))
      )
    )
  )
  with check (
    bucket_id = 'product-images'
    and owner_id = (select auth.uid()::text)
  );

create policy "Store image owners delete allowed images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-images'
    and owner_id = (select auth.uid()::text)
    and (
      (
        (select private.try_uuid((storage.foldername(name))[1])) is not null
        and (select private.has_active_store_role(
          (select private.try_uuid((storage.foldername(name))[1])),
          array['admin', 'manager']::public.membership_role[]
        ))
      )
      or (
        (storage.foldername(name))[1] = 'qr'
        and (select private.try_uuid((storage.foldername(name))[2])) is not null
        and (select private.has_active_store_role(
          (select private.try_uuid((storage.foldername(name))[2])),
          array['admin']::public.membership_role[]
        ))
      )
    )
  );
