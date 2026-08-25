-- Fix: `text[] || 'literal'` is ambiguous in PL/pgSQL.
--
-- Found in smoke testing before Phase 7C shipped. In pos_audit_product(),
--
--     _changes := _changes || 'buying cost changed';
--
-- fails at runtime with "malformed array literal": PostgreSQL cannot decide
-- whether an unadorned string literal on the right of || is an element to
-- append or an array to concatenate, and resolves it as an array. Any change
-- to pos_products.default_unit_cost therefore raised, which would have blocked
-- an Administrator from editing a product's buying cost at all.
--
-- Every append is now explicitly ::text so the element form is chosen. The
-- function is otherwise unchanged, including the deliberate omission of the
-- actual cost values -- what a product costs is financial history and belongs
-- to Reports and eventually FMS, not to an operational event stream that a
-- Manager RPC reads from the same table.

create or replace function public.pos_audit_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  _changes text[] := array[]::text[];
begin
  if tg_op = 'INSERT' then
    perform public.pos_audit_write(
      'product_created', 'product', new.id, null, new.name,
      'Product created', null, new.name);
    return null;
  end if;

  -- Status transitions are their own events, and are not repeated as a
  -- generic "updated".
  if old.status is distinct from new.status then
    if new.status = 'archived' then
      perform public.pos_audit_write('product_archived', 'product', new.id, null, new.name,
        'Product archived', old.status::text, new.status::text);
    elsif old.status = 'archived' then
      perform public.pos_audit_write('product_restored', 'product', new.id, null, new.name,
        'Product restored', old.status::text, new.status::text);
    else
      perform public.pos_audit_write('product_updated', 'product', new.id, null, new.name,
        'Product status changed', old.status::text, new.status::text);
    end if;
  end if;

  -- An allowlist, so a future column cannot start being audited by accident.
  -- category_id is deliberately absent: a product moves category during a
  -- category deletion, and auditing it there would produce one event per
  -- product for a single administrator action. The category_deleted event
  -- records the move instead.
  if old.name is distinct from new.name then
    _changes := _changes || ('name ' || old.name || ' -> ' || new.name)::text;
  end if;
  if old.default_selling_price is distinct from new.default_selling_price then
    _changes := _changes || ('selling price ' ||
      public.pos_audit_price_text(old.default_selling_price) || ' -> ' ||
      public.pos_audit_price_text(new.default_selling_price))::text;
  end if;
  -- That the buying cost changed, never what it changed to.
  if old.default_unit_cost is distinct from new.default_unit_cost then
    _changes := _changes || 'buying cost changed'::text;
  end if;

  if array_length(_changes, 1) is not null then
    perform public.pos_audit_write(
      'product_updated', 'product', new.id, null, new.name,
      'Product updated', null, array_to_string(_changes, '; '));
  end if;

  return null;
end;
$fn$;

-- Same ambiguity in the category writer's change list.
create or replace function public.pos_audit_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  _changes text[] := array[]::text[];
begin
  if tg_op = 'INSERT' then
    perform public.pos_audit_write('category_created', 'category', new.id, null, new.name,
      'Category created', null, new.name);
    return null;
  end if;

  -- Structural suppression: a sort_order-only change is a reorder, and
  -- reorder_pos_category() emits its own single aggregate event. Nothing a
  -- caller can set influences this -- it is decided by which columns moved.
  if old.name is not distinct from new.name
     and old.description is not distinct from new.description
     and old.color is not distinct from new.color
     and old.icon is not distinct from new.icon
     and old.is_active is not distinct from new.is_active then
    return null;
  end if;

  if old.is_active is distinct from new.is_active then
    perform public.pos_audit_write(
      case when new.is_active then 'category_restored' else 'category_archived' end,
      'category', new.id, null, new.name,
      case when new.is_active then 'Category restored' else 'Category archived' end,
      case when old.is_active then 'Active' else 'Retired' end,
      case when new.is_active then 'Active' else 'Retired' end);
  end if;

  if old.name is distinct from new.name then
    _changes := _changes || ('name ' || old.name || ' -> ' || new.name)::text;
  end if;
  if old.description is distinct from new.description then
    _changes := _changes || 'description changed'::text;
  end if;
  if old.color is distinct from new.color or old.icon is distinct from new.icon then
    _changes := _changes || 'appearance changed'::text;
  end if;

  if array_length(_changes, 1) is not null then
    perform public.pos_audit_write('category_updated', 'category', new.id, null, new.name,
      'Category updated', null, array_to_string(_changes, '; '));
  end if;

  return null;
end;
$fn$;

-- CREATE OR REPLACE preserves the ACL, but this database re-grants new
-- routines by default and has caught the project six times. Re-issue.
revoke all on function public.pos_audit_product() from public, anon, authenticated, service_role;
revoke all on function public.pos_audit_category() from public, anon, authenticated, service_role;
