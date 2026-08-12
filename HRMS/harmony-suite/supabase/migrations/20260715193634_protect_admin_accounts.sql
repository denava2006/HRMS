-- Enforces admin-account protection rules at the database layer so they hold
-- regardless of what the client sends — RLS alone lets any admin (or, via the
-- profiles_self_update self-service policy, any signed-in user acting on their
-- own row) freely rewrite role/status today.
create or replace function public.protect_admin_accounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    if OLD.role = 'admin' then
      raise exception 'Administrator accounts cannot be deleted.';
    end if;
    return OLD;
  end if;

  if OLD.role = 'admin' and NEW.role <> 'admin' then
    raise exception 'Administrator accounts cannot have their role changed.';
  end if;

  if OLD.role <> 'admin' and NEW.role = 'admin' then
    raise exception 'Administrator accounts cannot have their role changed.';
  end if;

  if OLD.role = 'admin' and OLD.status = 'active' and NEW.status <> 'active' then
    raise exception 'Administrator accounts cannot be deactivated.';
  end if;

  return NEW;
end;
$$;

create trigger trg_protect_admin_accounts
  before update or delete on public.profiles
  for each row execute function public.protect_admin_accounts();
