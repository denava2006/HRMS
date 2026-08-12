-- Atomically reorder one store's categories without touching immutable fields.
create or replace function public.reorder_product_category(
  _store_id uuid,
  _category_id uuid,
  _direction integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  _caller uuid := (select auth.uid());
  _ordered_ids uuid[];
  _current_position integer;
  _target_position integer;
begin
  if _caller is null
    or private.has_active_store_role(
      _store_id,
      array['admin', 'manager']::public.membership_role[]
    ) is not true
  then
    raise exception 'Admin or Manager access required';
  end if;

  if _direction is null or _direction not in (-1, 1) then
    raise exception 'Direction must be -1 or 1';
  end if;

  -- Serialize reorder operations for this store and establish one stable order.
  perform 1
  from public.product_categories
  where store_id = _store_id
  order by sort_order, name, id
  for update;

  select array_agg(id order by sort_order, name, id)
  into _ordered_ids
  from public.product_categories
  where store_id = _store_id;

  _current_position := array_position(_ordered_ids, _category_id);
  if _current_position is null then
    raise exception 'Category not found in the assigned store';
  end if;

  _target_position := _current_position + _direction;
  if _target_position < 1 or _target_position > coalesce(array_length(_ordered_ids, 1), 0) then
    return _current_position - 1;
  end if;

  -- Densify existing positions and swap the selected category with its
  -- adjacent category in one statement. No other column is included.
  with desired_order as (
    select
      category_id,
      (case
        when ordinal = _current_position then _target_position - 1
        when ordinal = _target_position then _current_position - 1
        else ordinal - 1
      end)::integer as desired_sort_order
    from unnest(_ordered_ids) with ordinality as ordered(category_id, ordinal)
  )
  update public.product_categories pc
  set sort_order = desired_order.desired_sort_order
  from desired_order
  where pc.id = desired_order.category_id
    and pc.store_id = _store_id
    and pc.sort_order is distinct from desired_order.desired_sort_order;

  return _target_position - 1;
end;
$$;

revoke all on function public.reorder_product_category(uuid, uuid, integer) from public;
grant execute on function public.reorder_product_category(uuid, uuid, integer) to authenticated;
