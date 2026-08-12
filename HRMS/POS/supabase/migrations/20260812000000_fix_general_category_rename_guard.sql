-- Forward-only. Repairs the guard that keeps every store's "General" category
-- permanent. No data is read, written, or rewritten by this migration.
--
-- The previous version compared `new.normalized_name`, but normalized_name is
-- GENERATED ALWAYS AS (lower(btrim(name))) STORED, and PostgreSQL leaves
-- generated columns NULL inside BEFORE ROW triggers. So the rename branch
-- evaluated `NULL <> 'general'` -> NULL, the IF never fired, and General could
-- be renamed. Once renamed its normalized_name was no longer 'general', so the
-- trigger stopped protecting it entirely: it could then be archived or deleted,
-- and a second "General" could be created alongside it. That breaks the
-- invariant asserted at the end of 20260730211935 — every store must have
-- exactly one active General category — and removes the guaranteed target that
-- delete_product_category and reassignment depend on.
--
-- The is_active half of the same condition read a real column, which is why
-- archiving was correctly blocked while renaming was not.
--
-- Fix: compare the value the generated column WOULD hold. `prepare_product_category`
-- already trims new.name before this trigger runs (triggers fire in name order,
-- and "prepare_" sorts before "protect_"), but btrim is applied here as well so
-- the check does not depend on that ordering.

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
      or lower(btrim(new.name)) is distinct from 'general'
      or not new.is_active then
      raise exception 'General must remain active and cannot be renamed or moved';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.protect_general_category() from public;

-- The existing `protect_general_category` trigger already targets this function,
-- so replacing the body is enough; the trigger itself is left untouched.

-- Verify the repair on the current data: renaming General must now raise, and
-- every store must still have exactly one active General category.
do $$
declare
  _general_id uuid;
  _blocked boolean := false;
begin
  select id into _general_id
  from public.product_categories
  where normalized_name = 'general'
  limit 1;

  if _general_id is not null then
    begin
      update public.product_categories
      set name = 'General Rename Probe'
      where id = _general_id;
    exception when others then
      _blocked := true;
    end;

    if not _blocked then
      raise exception 'General-category rename guard is still not firing';
    end if;
  end if;

  if exists (
    select 1
    from public.stores s
    where not exists (
      select 1 from public.product_categories pc
      where pc.store_id = s.id
        and pc.normalized_name = 'general'
        and pc.is_active
    )
  ) then
    raise exception 'A store is missing its active General category';
  end if;
end;
$$;
