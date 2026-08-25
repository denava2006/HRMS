-- Selective category reassignment.
--
-- Moves ONLY the product IDs an Admin or Manager explicitly selected out of a
-- source category and into a replacement category, in one transaction.
--
-- public.reassign_category_products (all products) is intentionally left in
-- place: public.delete_product_category still depends on that behaviour when a
-- category with assigned products is removed.

create or replace function public.reassign_category_products_subset(
  _store_id uuid,
  _category_id uuid,
  _replacement_category_id uuid,
  _product_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  _caller uuid := (select auth.uid());
  _count integer;
  _selected uuid[];
  _selected_count integer;
  _eligible_count integer;
  _source public.product_categories%rowtype;
  _replacement public.product_categories%rowtype;
begin
  -- 1. Authentication.
  if _caller is null then
    raise exception 'Authentication required';
  end if;

  -- 2. Argument sanity.
  if _store_id is null or _category_id is null or _replacement_category_id is null then
    raise exception 'A store, a source category and a replacement category are required';
  end if;

  -- 3. Authorization: active Admin or Manager of THIS store only. Cashiers and
  --    members of other stores fail here.
  if not private.has_active_store_role(
    _store_id,
    array['admin', 'manager']::public.membership_role[]
  ) then
    raise exception 'Admin or Manager access required';
  end if;

  if _category_id = _replacement_category_id then
    raise exception 'Choose a different replacement category';
  end if;

  -- 4. Reject an empty (or all-null) selection. Callers that really want every
  --    product must use public.reassign_category_products.
  select array(
    select distinct pid
    from unnest(coalesce(_product_ids, array[]::uuid[])) as pid
    where pid is not null
  ) into _selected;
  _selected_count := coalesce(array_length(_selected, 1), 0);
  if _selected_count = 0 then
    raise exception 'Select at least one product to move';
  end if;
  if _selected_count > 1000 then
    raise exception 'Move at most 1000 products at a time';
  end if;

  -- 5. Both categories must belong to this store; the destination must be
  --    active. Locked so a concurrent delete/archive cannot race this move.
  select * into _source
  from public.product_categories
  where id = _category_id and store_id = _store_id
  for update;
  if not found then
    raise exception 'The source category was not found in this store';
  end if;

  select * into _replacement
  from public.product_categories
  where id = _replacement_category_id and store_id = _store_id and is_active
  for update;
  if not found then
    raise exception 'A valid active replacement category is required';
  end if;

  -- 6. Every selected product must currently be in this store AND in the source
  --    category. Lock first, then verify, so the count cannot change underneath
  --    the update. A mismatch means the client sent a stale or foreign list, so
  --    the whole move is rejected rather than silently moving a subset.
  perform 1
  from public.products p
  where p.store_id = _store_id
    and p.id = any(_selected)
  order by p.id
  for update;

  select count(*) into _eligible_count
  from public.products p
  where p.store_id = _store_id
    and p.category_id = _source.id
    and p.id = any(_selected);

  if _eligible_count <> _selected_count then
    raise exception
      'Only % of the % selected products are still in this category. Refresh and try again.',
      _eligible_count, _selected_count;
  end if;

  -- 7. Move exactly the selected products.
  update public.products
  set category_id = _replacement.id
  where store_id = _store_id
    and category_id = _source.id
    and id = any(_selected);
  get diagnostics _count = row_count;

  if _count <> _selected_count then
    raise exception 'The selected products could not be moved. Refresh and try again.';
  end if;

  -- 8. Audit. 'category_products_reassigned' is already readable by Managers
  --    under the existing audit_logs policy, so no policy change is needed.
  insert into public.audit_logs (
    store_id, user_id, action, entity_type, entity_id, old_values, new_values
  ) values (
    _store_id, _caller, 'category_products_reassigned', 'product_category', _source.id,
    jsonb_build_object(
      'category_id', _source.id,
      'name', _source.name,
      'product_ids', to_jsonb(_selected),
      'selection', 'subset'
    ),
    jsonb_build_object(
      'replacement_category_id', _replacement.id,
      'replacement_name', _replacement.name,
      'product_count', _count
    )
  );

  return _count;
end;
$$;

revoke all on function public.reassign_category_products_subset(uuid, uuid, uuid, uuid[]) from public;
revoke all on function public.reassign_category_products_subset(uuid, uuid, uuid, uuid[]) from anon;
grant execute on function public.reassign_category_products_subset(uuid, uuid, uuid, uuid[]) to authenticated;
