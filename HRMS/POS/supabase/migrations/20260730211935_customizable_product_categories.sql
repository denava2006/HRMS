-- Customizable, store-specific product categories.
-- Forward-only: preserves products.category for temporary compatibility.

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  normalized_name text generated always as (lower(btrim(name))) stored,
  description text,
  color text,
  icon text,
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_categories_name_length check (char_length(btrim(name)) between 1 and 80),
  constraint product_categories_description_length check (description is null or char_length(description) <= 500),
  constraint product_categories_color_format check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint product_categories_icon_length check (icon is null or char_length(icon) <= 50),
  unique (id, store_id),
  unique (store_id, normalized_name)
);

create index product_categories_store_sort_idx
  on public.product_categories(store_id, is_active desc, sort_order, name);
create index product_categories_created_by_idx
  on public.product_categories(created_by)
  where created_by is not null;

alter table public.product_categories enable row level security;

create or replace function private.prepare_product_category()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.store_id is distinct from old.store_id then
      raise exception 'A category cannot be moved to another store';
    end if;
    if new.created_by is distinct from old.created_by then
      raise exception 'Category creator attribution cannot be changed';
    end if;
  end if;

  new.name := btrim(new.name);
  new.description := nullif(btrim(new.description), '');
  new.color := nullif(btrim(new.color), '');
  new.icon := nullif(btrim(new.icon), '');
  if new.created_by is null then
    new.created_by := (select auth.uid());
  end if;
  return new;
end;
$$;

revoke all on function private.prepare_product_category() from public;

create trigger prepare_product_category
  before insert or update on public.product_categories
  for each row execute function private.prepare_product_category();

create trigger product_categories_updated_at
  before update on public.product_categories
  for each row execute function public.update_updated_at();

-- General is inserted first so all spelling/case variants merge into it.
insert into public.product_categories (store_id, name, sort_order)
select s.id, 'General', 0
from public.stores s
on conflict (store_id, normalized_name) do nothing;

insert into public.product_categories (store_id, name, sort_order)
select distinct on (p.store_id, lower(btrim(p.category)))
  p.store_id,
  btrim(p.category),
  row_number() over (
    partition by p.store_id
    order by lower(btrim(p.category)), btrim(p.category)
  )::integer
from public.products p
where nullif(btrim(p.category), '') is not null
  and lower(btrim(p.category)) <> 'general'
order by p.store_id, lower(btrim(p.category)), btrim(p.category)
on conflict (store_id, normalized_name) do nothing;

alter table public.products
  add column category_id uuid;

update public.products p
set category_id = pc.id
from public.product_categories pc
where pc.store_id = p.store_id
  and pc.normalized_name = case
    when nullif(btrim(p.category), '') is null then 'general'
    else lower(btrim(p.category))
  end;

do $$
begin
  if exists (select 1 from public.products where category_id is null) then
    raise exception 'Category backfill failed: at least one product is unassigned';
  end if;
end;
$$;

alter table public.products
  alter column category_id set not null,
  add constraint products_category_same_store_fk
    foreign key (category_id, store_id)
    references public.product_categories(id, store_id)
    on update restrict
    on delete restrict;

create index products_store_category_idx
  on public.products(store_id, category_id);

create or replace function private.sync_product_category()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  _category public.product_categories%rowtype;
begin
  select * into _category
  from public.product_categories
  where id = new.category_id
    and store_id = new.store_id;

  if not found then
    raise exception 'The selected category does not belong to this store';
  end if;

  if (tg_op = 'INSERT' or new.category_id is distinct from old.category_id)
    and not _category.is_active then
    raise exception 'Inactive categories cannot be assigned to products';
  end if;

  new.category := _category.name;
  return new;
end;
$$;

revoke all on function private.sync_product_category() from public;

create trigger sync_product_category
  before insert or update of category_id, store_id, category on public.products
  for each row execute function private.sync_product_category();

create or replace function private.protect_general_category()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.normalized_name = 'general' then
    if tg_op = 'DELETE' then
      raise exception 'General cannot be deleted';
    end if;
    if new.store_id is distinct from old.store_id
      or new.normalized_name <> 'general'
      or not new.is_active then
      raise exception 'General must remain active and cannot be renamed or moved';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.protect_general_category() from public;

create trigger protect_general_category
  before update or delete on public.product_categories
  for each row execute function private.protect_general_category();

create or replace function private.sync_category_display_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.name is distinct from old.name then
    update public.products
    set category = new.name
    where store_id = new.store_id
      and category_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_category_display_name() from public;

create trigger sync_category_display_name
  after update of name on public.product_categories
  for each row execute function private.sync_category_display_name();

create or replace function private.ensure_general_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.product_categories (store_id, name, sort_order, created_by)
  values (new.id, 'General', 0, (select auth.uid()))
  on conflict (store_id, normalized_name) do nothing;
  return new;
end;
$$;

revoke all on function private.ensure_general_category() from public;

create trigger ensure_general_category
  after insert on public.stores
  for each row execute function private.ensure_general_category();

-- Category snapshots support future category reporting without rewriting sales.
alter table public.sale_items
  add column category_id uuid references public.product_categories(id) on delete set null,
  add column category_name text;

update public.sale_items si
set category_id = p.category_id,
    category_name = p.category
from public.products p
where p.id = si.product_id;

update public.sale_items
set category_name = 'Uncategorized'
where category_name is null;

alter table public.sale_items
  alter column category_name set default 'Uncategorized',
  alter column category_name set not null;

create index sale_items_category_idx on public.sale_items(category_id);

create or replace function private.snapshot_sale_item_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select p.category_id, p.category
  into new.category_id, new.category_name
  from public.products p
  where p.id = new.product_id;

  new.category_name := coalesce(nullif(btrim(new.category_name), ''), 'Uncategorized');
  return new;
end;
$$;

revoke all on function private.snapshot_sale_item_category() from public;

create trigger snapshot_sale_item_category
  before insert on public.sale_items
  for each row execute function private.snapshot_sale_item_category();

create policy "Management roles read store categories"
  on public.product_categories for select to authenticated
  using (
    (select private.has_active_store_role(
      product_categories.store_id,
      array['admin', 'manager']::public.membership_role[]
    ))
  );

create policy "Management roles create store categories"
  on public.product_categories for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (select private.has_active_store_role(
      product_categories.store_id,
      array['admin', 'manager']::public.membership_role[]
    ))
  );

create policy "Management roles update store categories"
  on public.product_categories for update to authenticated
  using (
    (select private.has_active_store_role(
      product_categories.store_id,
      array['admin', 'manager']::public.membership_role[]
    ))
  )
  with check (
    (select private.has_active_store_role(
      product_categories.store_id,
      array['admin', 'manager']::public.membership_role[]
    ))
  );

create or replace function public.get_pos_categories(_store_id uuid)
returns table (
  id uuid,
  name text,
  color text,
  icon text,
  sort_order integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select pc.id, pc.name, pc.color, pc.icon, pc.sort_order
  from public.product_categories pc
  where (select auth.uid()) is not null
    and pc.store_id = _store_id
    and pc.is_active
    and exists (
      select 1
      from public.store_memberships sm
      where sm.store_id = _store_id
        and sm.user_id = (select auth.uid())
        and sm.status = 'active'
        and sm.role in ('admin', 'manager', 'cashier')
    )
  order by pc.sort_order, pc.name;
$$;

revoke all on function public.get_pos_categories(uuid) from public;
grant execute on function public.get_pos_categories(uuid) to authenticated;

drop function if exists public.get_pos_products(uuid);
create function public.get_pos_products(_store_id uuid)
returns table (
  id uuid,
  name text,
  category text,
  category_id uuid,
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
    p.category_id,
    p.stock,
    p.selling_price,
    p.image_url,
    p.is_deleted,
    p.store_id
  from public.products p
  where (select auth.uid()) is not null
    and p.store_id = _store_id
    and not p.is_deleted
    and not p.is_archived
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

create or replace function public.reassign_category_products(
  _store_id uuid,
  _category_id uuid,
  _replacement_category_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  _caller uuid := (select auth.uid());
  _count integer;
  _source public.product_categories%rowtype;
  _replacement public.product_categories%rowtype;
begin
  if _caller is null or not private.has_active_store_role(
    _store_id,
    array['admin', 'manager']::public.membership_role[]
  ) then
    raise exception 'Admin or Manager access required';
  end if;
  if _category_id = _replacement_category_id then
    raise exception 'Choose a different replacement category';
  end if;

  select * into _source from public.product_categories
  where id = _category_id and store_id = _store_id for update;
  select * into _replacement from public.product_categories
  where id = _replacement_category_id and store_id = _store_id and is_active for update;
  if _source.id is null or _replacement.id is null then
    raise exception 'A valid active replacement category is required';
  end if;

  update public.products
  set category_id = _replacement.id
  where store_id = _store_id and category_id = _source.id;
  get diagnostics _count = row_count;

  insert into public.audit_logs (
    store_id, user_id, action, entity_type, entity_id, old_values, new_values
  ) values (
    _store_id, _caller, 'category_products_reassigned', 'product_category', _source.id,
    jsonb_build_object('category_id', _source.id, 'name', _source.name),
    jsonb_build_object('replacement_category_id', _replacement.id, 'replacement_name', _replacement.name, 'product_count', _count)
  );
  return _count;
end;
$$;

revoke all on function public.reassign_category_products(uuid, uuid, uuid) from public;
grant execute on function public.reassign_category_products(uuid, uuid, uuid) to authenticated;

create or replace function public.delete_product_category(
  _store_id uuid,
  _category_id uuid,
  _replacement_category_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  _caller uuid := (select auth.uid());
  _category public.product_categories%rowtype;
  _replacement public.product_categories%rowtype;
  _count integer;
begin
  if _caller is null or not private.has_active_store_role(
    _store_id,
    array['admin']::public.membership_role[]
  ) then
    raise exception 'Admin access required';
  end if;

  select * into _category from public.product_categories
  where id = _category_id and store_id = _store_id for update;
  if _category.id is null then raise exception 'Category not found'; end if;
  if _category.normalized_name = 'general' then raise exception 'General cannot be deleted'; end if;

  select count(*) into _count
  from public.products
  where store_id = _store_id and category_id = _category.id;

  if _count > 0 then
    select * into _replacement from public.product_categories
    where id = _replacement_category_id
      and store_id = _store_id
      and is_active
      and id <> _category.id
    for update;
    if _replacement.id is null then
      raise exception 'A valid active replacement category is required for % assigned products', _count;
    end if;
    update public.products
    set category_id = _replacement.id
    where store_id = _store_id and category_id = _category.id;
    insert into public.audit_logs (
      store_id, user_id, action, entity_type, entity_id, old_values, new_values
    ) values (
      _store_id, _caller, 'category_products_reassigned', 'product_category', _category.id,
      jsonb_build_object('category_id', _category.id, 'name', _category.name),
      jsonb_build_object('replacement_category_id', _replacement.id, 'replacement_name', _replacement.name, 'product_count', _count)
    );
  end if;

  delete from public.product_categories where id = _category.id and store_id = _store_id;
  insert into public.audit_logs (
    store_id, user_id, action, entity_type, entity_id, old_values
  ) values (
    _store_id, _caller, 'category_deleted', 'product_category', _category.id, to_jsonb(_category)
  );
  return _count;
end;
$$;

revoke all on function public.delete_product_category(uuid, uuid, uuid) from public;
grant execute on function public.delete_product_category(uuid, uuid, uuid) to authenticated;

create or replace function private.audit_category_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _action text;
begin
  if tg_op = 'INSERT' then
    _action := 'category_created';
  elsif new.is_active and not old.is_active then
    _action := 'category_restored';
  elsif not new.is_active and old.is_active then
    _action := 'category_archived';
  elsif new.sort_order is distinct from old.sort_order
    and (to_jsonb(new) - 'sort_order' - 'updated_at') = (to_jsonb(old) - 'sort_order' - 'updated_at') then
    _action := 'category_reordered';
  else
    _action := 'category_edited';
  end if;

  insert into public.audit_logs (
    store_id, user_id, action, entity_type, entity_id, old_values, new_values
  ) values (
    new.store_id, (select auth.uid()), _action, 'product_category', new.id,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new)
  );
  return new;
end;
$$;

revoke all on function private.audit_category_change() from public;

create trigger audit_category_changes
  after insert or update on public.product_categories
  for each row execute function private.audit_category_change();

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
        'category_products_reassigned'
      )
    )
  );

revoke all privileges on table public.product_categories from anon;
revoke all privileges on table public.product_categories from authenticated;
grant select, insert, update on table public.product_categories to authenticated;

grant select, insert, update, delete on table public.product_categories to service_role;

do $$
begin
  if exists (
    select store_id
    from public.product_categories
    where normalized_name = 'general' and is_active
    group by store_id
    having count(*) <> 1
  ) or exists (
    select 1
    from public.stores s
    where not exists (
      select 1 from public.product_categories pc
      where pc.store_id = s.id
        and pc.normalized_name = 'general'
        and pc.is_active
    )
  ) then
    raise exception 'Every store must have exactly one active General category';
  end if;
end;
$$;
