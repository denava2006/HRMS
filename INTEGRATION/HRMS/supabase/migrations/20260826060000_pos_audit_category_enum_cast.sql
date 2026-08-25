-- Fix: a CASE expression does not resolve to an enum in function overload
-- resolution.
--
-- Caught by the existing pos_dashboard_rls suite, which archives a category.
-- In pos_audit_category(),
--
--     perform public.pos_audit_write(
--       case when new.is_active then 'category_restored' else 'category_archived' end,
--       ...)
--
-- fails with
--
--     function public.pos_audit_write(text, unknown, uuid, unknown, ...) does not exist
--
-- A bare string literal is `unknown` and happily resolves to
-- pos_audit_event_type; a CASE over string literals resolves to `text` first,
-- and PostgreSQL will not implicitly cast text to an enum when choosing an
-- overload. Archiving or restoring any category therefore raised -- which
-- would have blocked an Administrator from retiring a category at all.
--
-- Cast the CASE explicitly. The function is otherwise unchanged.

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
      (case when new.is_active then 'category_restored' else 'category_archived' end)
        ::public.pos_audit_event_type,
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

revoke all on function public.pos_audit_category() from public, anon, authenticated, service_role;
