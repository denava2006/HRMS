-- Managers may operate inventory but only Admins may archive or soft-delete.
create or replace function private.enforce_product_role_boundaries()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  _role public.membership_role;
begin
  _role := private.active_store_role(new.store_id);
  if _role = 'manager'
    and (
      new.is_archived is distinct from old.is_archived
      or new.is_deleted is distinct from old.is_deleted
    ) then
    raise exception 'Only an Admin can archive or remove products';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_product_role_boundaries() from public;

create trigger enforce_product_role_boundaries
  before update on public.products
  for each row execute function private.enforce_product_role_boundaries();
