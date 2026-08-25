-- What a POS Manager needs to manage a branch catalogue.
--
-- get_pos_catalogue() deliberately returns only what a till may sell: active
-- products the branch is currently offering. That strictness is the point --
-- a till cannot render something it must not sell, even if a later caller
-- forgets to filter.
--
-- It leaves a POS Manager unable to do the one job they have here, though.
-- Pausing a product removes it from that result, so the manager who paused it
-- can no longer see its name to switch it back on: pos_products is
-- Administrator-only, so the name is not reachable any other way. Managing by
-- opaque uuid is not managing.
--
-- Rather than loosening the till's view, this adds a second, narrower one.
-- Manager-only, the same branch scoping, still no cost column.

create or replace function public.get_branch_catalogue_management(_branch_id uuid)
returns table (
  product_id uuid,
  name text,
  category_id uuid,
  category_name text,
  selling_price numeric,
  image_path text,
  is_available boolean,
  product_status public.pos_product_status
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.name,
    p.category_id,
    c.name,
    coalesce(bp.selling_price_override, p.default_selling_price),
    p.image_path,
    bp.is_available,
    p.status
  from public.pos_branch_products bp
  join public.pos_products p on p.id = bp.product_id
  join public.pos_product_categories c on c.id = p.category_id
  where bp.branch_id = _branch_id
    -- Managers only. A cashier has nothing to manage and keeps the strict view.
    and public.has_pos_role(_branch_id, array['manager']::public.pos_role[])
  order by c.sort_order, c.name, p.name;
$$;

comment on function public.get_branch_catalogue_management(uuid) is
  'Every product a branch carries, paused ones included, for the POS Manager who administers availability. Returns no cost, margin or COGS.';

-- Both revokes, for the reason 20260825030000 records: PUBLIC holds EXECUTE on
-- a new function by default, and this database has also historically granted
-- anon explicitly through ALTER DEFAULT PRIVILEGES. Neither revoke alone is
-- sufficient here.
revoke all on function public.get_branch_catalogue_management(uuid) from public;
revoke all on function public.get_branch_catalogue_management(uuid) from anon;
grant execute on function public.get_branch_catalogue_management(uuid) to authenticated, service_role;
