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
