-- handle_new_user still referenced the dropped legacy `user_roles` table,
-- which would fail (and abort) every future auth.users insert. Rewriting it
-- to match the actual schema: auto-create a matching profiles row on signup.
-- Role/status use the profiles table's own column defaults (hr_staff/active);
-- the Admin "Create HR Account" flow (Phase 2) updates role explicitly right
-- after creation for anyone who needs to be an Admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Advisor flagged these two as missing a pinned search_path.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.generate_employee_number()
returns text
language plpgsql
set search_path = public
as $$
declare
  next_val bigint;
begin
  next_val := nextval('employee_number_seq');
  return 'EMP-' || to_char(current_date, 'YYYY') || '-' || lpad(next_val::text, 5, '0');
end;
$$;

-- These three are only ever meant to be called from within RLS policies /
-- triggers evaluated for a signed-in user, not invoked directly over the
-- public RPC endpoint by anonymous callers.
revoke execute on function public.is_admin() from public;
revoke execute on function public.is_active_staff() from public;
revoke execute on function public.prevent_self_role_escalation() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_active_staff() to authenticated;
