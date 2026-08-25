-- The POS catalogue: products and categories.
--
-- The standalone POS scopes a product to a `stores` row, so "Coke 1.5L" at one
-- store and "Coke 1.5L" at another are unrelated records with different ids.
-- That works when each store is a separate business. JMAC's branches are one
-- business, so the same model here would mean consolidated reporting has to
-- match products by name, FMS would purchase against a separate catalogue per
-- branch, and a future stock transfer between branches would be a rename
-- exercise.
--
-- So identity is enterprise-level and only what genuinely varies by branch is
-- branch-level:
--
--   pos_product_categories   one global taxonomy
--   pos_products             the product master -- name, category, prices, image
--   pos_branch_products      which branches carry it, and at what price
--
-- WHAT IS DELIBERATELY ABSENT: stock.
--
-- In the standalone POS, products.stock is a live balance coupled to a ledger:
-- creating a product fires a trigger writing an `initial_stock` movement, and a
-- second trigger refuses any direct stock UPDATE unless a session GUC marks the
-- write as coming from one of the inventory RPCs. Porting the column without
-- that machinery would create an unguarded quantity that nothing reconciles --
-- a second inventory model competing with the real one. Porting the machinery
-- would drag the whole ledger into this migration.
--
-- Neither is needed. A product is not sellable until stock is received, so
-- every row here would carry stock = 0 regardless. Phase 4 introduces the
-- balance, the ledger, the guard and the movement rules together, in the one
-- migration where they can be made consistent with each other.

-- ---------------------------------------------------------------- categories

create table public.pos_product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Generated so uniqueness cannot be dodged by case or padding: "Drinks",
  -- "drinks" and " Drinks " are one category.
  normalized_name text generated always as (lower(btrim(name))) stored,
  description text,
  color text,
  icon text,
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pos_product_categories_name_length
    check (char_length(btrim(name)) between 1 and 80),
  constraint pos_product_categories_description_length
    check (description is null or char_length(description) <= 500),
  constraint pos_product_categories_color_format
    check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint pos_product_categories_icon_length
    check (icon is null or char_length(icon) <= 50),
  -- Enterprise-wide, not per branch: a product has exactly one category, and
  -- products are enterprise-level.
  unique (normalized_name)
);

create index pos_product_categories_sort_idx
  on public.pos_product_categories (is_active desc, sort_order, name);

-- ------------------------------------------------------------------ products

create type public.pos_product_status as enum ('draft', 'active', 'archived');

create table public.pos_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text generated always as (lower(btrim(name))) stored,
  -- restrict, not cascade: a category holding products must refuse to vanish
  -- and say so. delete_pos_category() is the supported route, and it insists on
  -- a replacement.
  category_id uuid not null references public.pos_product_categories(id) on delete restrict,

  -- Enterprise defaults. A branch may override the selling price in
  -- pos_branch_products; cost has no branch override because actual cost
  -- belongs to Phase 4's ledger, which records it per movement.
  default_selling_price numeric(12,2) not null default 0 check (default_selling_price >= 0),
  default_unit_cost numeric(12,2) not null default 0 check (default_unit_cost >= 0),

  -- Storage object path, never a URL. A signed URL expires; a path does not.
  image_path text,

  -- draft   created, not yet sellable anywhere
  -- active  may be carried by branches
  -- archived withdrawn; disappears from every POS-facing catalogue
  status public.pos_product_status not null default 'draft',

  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint pos_products_name_length check (char_length(btrim(name)) between 1 and 120),
  -- One physical product, one record. This is the whole point of an enterprise
  -- master: without it, two administrators can re-create the same item and the
  -- branch-level joins silently describe two different things.
  unique (normalized_name),
  -- The image must live in the product's own folder, matching what the storage
  -- policies authorise on.
  constraint pos_products_image_path_scoped
    check (image_path is null or image_path like id::text || '/%')
);

create index pos_products_category_idx on public.pos_products (category_id);
create index pos_products_status_idx on public.pos_products (status) where status = 'active';

-- --------------------------------------------------------- branch catalogue

create table public.pos_branch_products (
  -- restrict: a branch carrying products should refuse deletion and say so,
  -- the same way branches already refuse when POS staff are assigned.
  branch_id uuid not null references public.branches(id) on delete restrict,
  product_id uuid not null references public.pos_products(id) on delete cascade,

  -- "This approved product is carried at this branch." NOT "there is stock" and
  -- NOT "it is sellable" -- sellability additionally requires the product to be
  -- active and, from Phase 4, for stock to exist.
  is_available boolean not null default true,

  -- null means "use the enterprise default".
  selling_price_override numeric(12,2) check (selling_price_override >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (branch_id, product_id)
);

create index pos_branch_products_product_idx on public.pos_branch_products (product_id);
create index pos_branch_products_available_idx
  on public.pos_branch_products (branch_id) where is_available;

-- ------------------------------------------------------------------ triggers

create trigger trg_set_updated_at before update on public.pos_product_categories
  for each row execute function public.set_updated_at();
create trigger trg_set_updated_at before update on public.pos_products
  for each row execute function public.set_updated_at();
create trigger trg_set_updated_at before update on public.pos_branch_products
  for each row execute function public.set_updated_at();

-- Normalise input and stamp the author, the same way Phase 2C made
-- pos_branch_assignments.created_by a record rather than a claim.
create or replace function public.prepare_pos_catalogue_row()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.name := btrim(new.name);

  if tg_table_name = 'pos_product_categories' then
    new.description := nullif(btrim(new.description), '');
    new.color := nullif(btrim(new.color), '');
    new.icon := nullif(btrim(new.icon), '');
  end if;

  if tg_op = 'INSERT' then
    if (select auth.uid()) is not null then
      new.created_by := (select auth.uid());
    end if;
  else
    new.created_by := old.created_by;
  end if;

  return new;
end;
$$;

create trigger trg_prepare_row before insert or update on public.pos_product_categories
  for each row execute function public.prepare_pos_catalogue_row();
create trigger trg_prepare_row before insert or update on public.pos_products
  for each row execute function public.prepare_pos_catalogue_row();

-- The General category is permanent.
--
-- It is the guaranteed target that delete_pos_category() reassigns orphaned
-- products to, so if it could be renamed, archived or deleted, category
-- deletion would have nowhere to put them.
--
-- Note the comparison. `normalized_name` is GENERATED ALWAYS ... STORED, and
-- PostgreSQL leaves generated columns NULL inside a BEFORE ROW trigger. The
-- standalone POS's first attempt compared new.normalized_name, which was always
-- NULL, so `NULL <> 'general'` evaluated to NULL, the branch never fired, and
-- General could be renamed -- after which it was no longer protected at all
-- (its normalized_name stopped being 'general'). This compares the value the
-- column WOULD hold. The corrected behaviour is ported, not the original bug.
create or replace function public.protect_general_pos_category()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.normalized_name = 'general' then
      raise exception 'The General category is permanent and cannot be deleted';
    end if;
    return old;
  end if;

  if old.normalized_name = 'general' then
    if lower(btrim(new.name)) <> 'general' then
      raise exception 'The General category cannot be renamed';
    end if;
    if not new.is_active then
      raise exception 'The General category cannot be archived';
    end if;
  end if;
  return new;
end;
$$;

-- "protect_" sorts after "prepare_", so name trimming has already happened.
create trigger trg_protect_general before update or delete on public.pos_product_categories
  for each row execute function public.protect_general_pos_category();

-- A POS Manager may say whether their branch carries a product. They may not
-- price it, and they may not move a row to another branch. RLS cannot express
-- "these columns only", so a trigger does.
create or replace function public.enforce_branch_product_boundaries()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.branch_id is distinct from old.branch_id
     or new.product_id is distinct from old.product_id then
    raise exception 'A branch catalogue entry cannot be moved to another branch or product';
  end if;

  if new.selling_price_override is distinct from old.selling_price_override then
    raise exception 'Only an Administrator can set a branch selling price';
  end if;

  return new;
end;
$$;

create trigger trg_enforce_branch_product_boundaries
  before update on public.pos_branch_products
  for each row execute function public.enforce_branch_product_boundaries();

-- ---------------------------------------------------------------------- RLS
--
-- The tables are Administrator-only. POS staff never read them directly, even
-- though a policy could be written to allow it: the catalogue is served by
-- SECURITY DEFINER RPCs that return exactly the columns a till needs and omit
-- cost entirely. Exposing the table and trusting a SELECT list to stay
-- cost-free is a weaker guarantee than not exposing the table.

alter table public.pos_product_categories enable row level security;
alter table public.pos_products enable row level security;
alter table public.pos_branch_products enable row level security;

create policy pos_product_categories_admin_manage on public.pos_product_categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy pos_products_admin_manage on public.pos_products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Branch catalogue rows are the one place a POS Manager writes. Reading is
-- open to assigned POS staff so the branch-availability screen can list them;
-- there is nothing sensitive here (no cost), and the write path is column-
-- restricted by the trigger above.
create policy pos_branch_products_pos_select on public.pos_branch_products
  for select to authenticated
  using (public.has_pos_role(branch_id, array['manager', 'cashier']::public.pos_role[]));

create policy pos_branch_products_manager_update on public.pos_branch_products
  for update to authenticated
  using (public.has_pos_role(branch_id, array['manager']::public.pos_role[]))
  with check (public.has_pos_role(branch_id, array['manager']::public.pos_role[]));

-- Deciding that a branch carries a product at all is enterprise product
-- administration, so creating and removing the row stays with an Administrator.
-- A manager toggles what already exists.
create policy pos_branch_products_admin_manage on public.pos_branch_products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant all privileges on table public.pos_product_categories to anon, authenticated, service_role;
grant all privileges on table public.pos_products to anon, authenticated, service_role;
grant all privileges on table public.pos_branch_products to anon, authenticated, service_role;

-- ---------------------------------------------------------------------- RPCs

-- The categories a POS user may pick from. Active only, and never the
-- administrative columns.
create or replace function public.get_pos_categories()
returns table (id uuid, name text, color text, icon text, sort_order integer)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.color, c.icon, c.sort_order
  from public.pos_product_categories c
  where c.is_active
    and public.has_pos_access()
  order by c.sort_order, c.name;
$$;

-- A branch's sellable catalogue.
--
-- No cost, no margin, no COGS, no administrative metadata -- not filtered out
-- of a wider row but never selected in the first place. Archived and draft
-- products and unavailable branch entries are excluded, so a till cannot show
-- something it must not sell.
--
-- `has_pos_role` is the authorization: an Administrator passes for any branch,
-- everyone else only for a branch they hold an active assignment at, and the
-- profile behind that assignment must still be active.
create or replace function public.get_pos_catalogue(_branch_id uuid)
returns table (
  product_id uuid,
  name text,
  category_id uuid,
  category_name text,
  selling_price numeric,
  image_path text
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
    p.image_path
  from public.pos_branch_products bp
  join public.pos_products p on p.id = bp.product_id
  join public.pos_product_categories c on c.id = p.category_id
  where bp.branch_id = _branch_id
    and bp.is_available
    and p.status = 'active'
    and public.has_pos_role(_branch_id, array['manager', 'cashier']::public.pos_role[])
  order by c.sort_order, c.name, p.name;
$$;

-- Deleting a category has to say where its products go: pos_products.category_id
-- is NOT NULL, so a category holding products cannot simply vanish. General is
-- always a valid target, which is why it is permanent.
create or replace function public.delete_pos_category(_category_id uuid, _replacement_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _category public.pos_product_categories%rowtype;
  _replacement public.pos_product_categories%rowtype;
  _count integer;
begin
  if not public.is_admin() then
    raise exception 'Only an Administrator can delete a category';
  end if;

  select * into _category from public.pos_product_categories where id = _category_id;
  if _category.id is null then
    raise exception 'Category not found';
  end if;
  if _category.normalized_name = 'general' then
    raise exception 'The General category is permanent and cannot be deleted';
  end if;

  select count(*) into _count from public.pos_products where category_id = _category_id;

  if _count > 0 then
    if _replacement_id is null or _replacement_id = _category_id then
      raise exception 'Choose where the % product(s) in this category should go', _count;
    end if;
    select * into _replacement from public.pos_product_categories where id = _replacement_id;
    if _replacement.id is null or not _replacement.is_active then
      raise exception 'The replacement category must exist and be active';
    end if;
    update public.pos_products set category_id = _replacement_id where category_id = _category_id;
  end if;

  delete from public.pos_product_categories where id = _category_id;
end;
$$;

-- Moves a category one place up (-1) or down (+1) by swapping sort_order with
-- its neighbour, then renumbering so the sequence stays dense.
create or replace function public.reorder_pos_category(_category_id uuid, _direction integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _ids uuid[];
  _index integer;
  _target integer;
  _swap uuid;
begin
  if not public.is_admin() then
    raise exception 'Only an Administrator can reorder categories';
  end if;
  if _direction not in (-1, 1) then
    raise exception 'Direction must be -1 or 1';
  end if;

  select array_agg(id order by sort_order, name) into _ids
  from public.pos_product_categories;

  _index := array_position(_ids, _category_id);
  if _index is null then
    raise exception 'Category not found';
  end if;

  _target := _index + _direction;
  if _target < 1 or _target > array_length(_ids, 1) then
    return; -- already at the end; a no-op rather than an error
  end if;

  _swap := _ids[_target];
  _ids[_target] := _ids[_index];
  _ids[_index] := _swap;

  for _index in 1 .. array_length(_ids, 1) loop
    update public.pos_product_categories
      set sort_order = _index
      where id = _ids[_index];
  end loop;
end;
$$;

revoke all on function public.get_pos_categories() from anon;
revoke all on function public.get_pos_catalogue(uuid) from anon;
revoke all on function public.delete_pos_category(uuid, uuid) from anon;
revoke all on function public.reorder_pos_category(uuid, integer) from anon;
revoke all on function public.prepare_pos_catalogue_row() from anon;
revoke all on function public.protect_general_pos_category() from anon;
revoke all on function public.enforce_branch_product_boundaries() from anon;

grant execute on function public.get_pos_categories() to authenticated, service_role;
grant execute on function public.get_pos_catalogue(uuid) to authenticated, service_role;
grant execute on function public.delete_pos_category(uuid, uuid) to authenticated, service_role;
grant execute on function public.reorder_pos_category(uuid, integer) to authenticated, service_role;

-- -------------------------------------------------------- product images

-- Private, like every other bucket in this system. A catalogue is commercially
-- sensitive in a way a single image is not: a public bucket lets anyone who
-- learns the URL shape enumerate the product range. Images are served through
-- short-lived signed URLs minted for callers the policy already admitted.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pos-product-images',
  'pos-product-images',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- Objects are `<product_id>/<uuid>.<ext>`. Products are enterprise-level, not
-- branch-scoped, so the question is "may this account see the catalogue at
-- all", not "which branch".
create policy pos_product_images_read on storage.objects
  for select to authenticated
  using (bucket_id = 'pos-product-images' and public.has_pos_access());

create policy pos_product_images_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'pos-product-images' and public.is_admin());

create policy pos_product_images_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'pos-product-images' and public.is_admin())
  with check (bucket_id = 'pos-product-images' and public.is_admin());

create policy pos_product_images_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'pos-product-images' and public.is_admin());

-- ------------------------------------------------------------------ General

-- Structural, not demo data: delete_pos_category() depends on this row
-- existing, so it belongs in the migration rather than in seed.sql.
insert into public.pos_product_categories (name, sort_order, description)
values ('General', 0, 'The default category. Products land here when no other category fits.')
on conflict (normalized_name) do nothing;
