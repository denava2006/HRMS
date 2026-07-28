-- auth.uid() is only populated for requests carrying an end-user JWT (i.e.
-- calls that went through the app/PostgREST). A NULL auth.uid() means this
-- is direct database-level access (SQL Editor, a migration, a service-role
-- script) -- already gated by Supabase project credentials, a stronger
-- boundary than this trigger. Only second-guess role/status changes when
-- there IS an authenticated end-user context and they aren't an admin.
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role or new.status is distinct from old.status then
      raise exception 'Only an administrator can change role or status.';
    end if;
  end if;
  return new;
end;
$$;
