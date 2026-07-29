-- HR Manager is a superset of HR Staff: every existing *_staff_all policy routes
-- through is_active_staff(), so widening this one function is what grants HR
-- Manager the full HR Staff surface app-wide.
create or replace function public.is_active_staff()
returns boolean
language sql stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active' and role in ('admin','hr_staff','hr_manager')
  );
$function$;

-- The approval authority HR Staff does NOT have. Deliberately excludes hr_staff
-- and employee; admin retains it so a single-admin deployment is never locked
-- out of its own payroll/leave.
create or replace function public.is_hr_manager_or_admin()
returns boolean
language sql stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active' and role in ('admin','hr_manager')
  );
$function$;

revoke execute on function public.is_hr_manager_or_admin() from public, anon, authenticated;
grant execute on function public.is_hr_manager_or_admin() to authenticated;

-- Leave: HR Staff files and records requests; only an HR Manager (or Admin)
-- decides them. RLS can't express "may update the row, but not THIS transition",
-- so this follows the protect_admin_accounts()/protect_interview_ownership()
-- trigger precedent instead. The message is user-facing -- it surfaces straight
-- through useLeave's toast.error(error.message).
create or replace function public.protect_leave_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if OLD.status = 'pending' and NEW.status in ('approved','rejected')
     and not is_hr_manager_or_admin() then
    raise exception 'Only an HR Manager can approve or reject leave requests.';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_protect_leave_approval on public.leave_requests;
create trigger trg_protect_leave_approval
  before update on public.leave_requests
  for each row execute function public.protect_leave_approval();

-- Payroll: HR Staff generates and adjusts (both of which write status='draft');
-- advancing to reviewed/released is the HR Manager's call. Guards both tables
-- because useReviewPayroll updates every payroll_records row first and the
-- period second -- gating only the period would let the records advance and
-- leave the batch half-approved.
create or replace function public.protect_payroll_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status is distinct from OLD.status
     and NEW.status in ('reviewed','released')
     and not is_hr_manager_or_admin() then
    raise exception 'Only an HR Manager can review or release payroll.';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_protect_payroll_period_approval on public.payroll_periods;
create trigger trg_protect_payroll_period_approval
  before update on public.payroll_periods
  for each row execute function public.protect_payroll_approval();

drop trigger if exists trg_protect_payroll_record_approval on public.payroll_records;
create trigger trg_protect_payroll_record_approval
  before update on public.payroll_records
  for each row execute function public.protect_payroll_approval();
