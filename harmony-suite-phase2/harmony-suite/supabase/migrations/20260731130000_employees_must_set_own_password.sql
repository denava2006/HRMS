-- An employee's first login must go through creating their own password.
--
-- create-employee-account stamped profiles.activated_at at the moment it made
-- the account, which is what "activated" was supposed to mean: the person has
-- set a password only they know. Stamping it up front made it mean nothing —
-- every employee walked straight into the app still on the documented default,
-- and the Account tab reported them as Activated while HR could read their
-- password off the screen.
--
-- activated_at now means what it says. It is null from account creation until
-- the employee actually changes their password, and HR resetting the password
-- puts it back to null.

-- ---------- The stamp comes from the password change itself ----------
-- Hooking auth.users rather than trusting the client is the whole point: the
-- flag clears because encrypted_password genuinely changed, not because a page
-- said it did. Same pattern as handle_new_user (20260716070100).
create or replace function public.stamp_activation_on_password_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update public.profiles
    set activated_at = now()
    where id = new.id and activated_at is null;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_stamp_activation_on_password_change on auth.users;
create trigger trg_stamp_activation_on_password_change
  after update on auth.users
  for each row execute function public.stamp_activation_on_password_change();

-- ---------- And nowhere else ----------
-- profiles_self_update lets anyone write their own row, so without this an
-- employee could mark themselves activated and skip the page entirely.
-- pg_trigger_depth() > 1 is how the trigger above is let through: it runs
-- nested inside the auth.users update, while a direct API call is at depth 1.
create or replace function public.protect_activation_stamp()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.activated_at is distinct from old.activated_at
     and pg_trigger_depth() <= 1
     and (select auth.uid()) is not null
     and not public.is_hr_staff_or_admin() then
    raise exception 'Activation is recorded when you change your password, not set directly.';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_protect_activation_stamp on public.profiles;
create trigger trg_protect_activation_stamp
  before update on public.profiles
  for each row execute function public.protect_activation_stamp();

-- ---------- Existing employees never chose their password ----------
-- Every employee account created so far was stamped activated on creation and
-- is still on the default. They are exactly the population this change is for,
-- so they go through the same first-login setup.
update public.profiles
set activated_at = null
where role = 'employee';
