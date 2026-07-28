
-- SECURITY FIX: is_active_staff() only ever checked status='active', never role.
-- Every policy in the app using it (employees/attendance/leave/payroll/recruitment/
-- interviews/deployment/documents/audit_logs/storage/etc) intends "HR staff or
-- Admin" -- but an 'employee' role profile is ALSO status='active' by default
-- from the moment HR sends the invite, so employee logins have silently had
-- full read/write access to every one of those tables via direct API calls
-- this whole time, regardless of what the frontend hides. Restoring the
-- originally-intended role check closes that gap app-wide in one place.
create or replace function public.is_active_staff()
returns boolean
language sql stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active' and role in ('admin','hr_staff')
  );
$function$;

create or replace function public.is_active_employee()
returns boolean
language sql stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active' and role = 'employee'
  );
$function$;

create or replace function public.my_employee_id()
returns uuid
language sql stable security definer
set search_path to 'public'
as $function$
  select employee_id from public.profiles where id = auth.uid();
$function$;

-- profiles: is_active_staff() no longer covers employees reading their own row
-- (needed for login/Navbar/every employee-portal query), so give every user an
-- explicit self-select policy regardless of role.
create policy profiles_self_select on profiles
  for select using (id = auth.uid());

-- employees: read own record only.
create policy employees_self_select on employees
  for select using (is_active_employee() and id = my_employee_id());

-- attendance_records: read own; Time In inserts today's row; Time Out is the
-- only permitted update (once), guarded by attendance_date and time_out IS NULL
-- so a completed day's row can never be touched again. The +/-1 day window
-- (rather than a hard "= current_date") absorbs client/server timezone skew;
-- exact "must be today in the employee's own timezone" is enforced client-side,
-- same as the rest of this app's attendance logic.
create policy attendance_records_self_select on attendance_records
  for select using (is_active_employee() and employee_id = my_employee_id());

create policy attendance_records_self_insert on attendance_records
  for insert with check (
    is_active_employee() and employee_id = my_employee_id()
    and attendance_date between (current_date - interval '1 day') and (current_date + interval '1 day')
  );

create policy attendance_records_self_timeout on attendance_records
  for update
  using (
    is_active_employee() and employee_id = my_employee_id() and time_out is null
    and attendance_date between (current_date - interval '1 day') and (current_date + interval '1 day')
  )
  with check (is_active_employee() and employee_id = my_employee_id());

-- leave_requests: read own; submit new (pending) requests only -- approve/reject
-- stays HR-only via the existing leave_requests_staff_all policy.
create policy leave_requests_self_select on leave_requests
  for select using (is_active_employee() and employee_id = my_employee_id());

create policy leave_requests_self_insert on leave_requests
  for insert with check (
    is_active_employee() and employee_id = my_employee_id() and status = 'pending'
  );

-- leave_balances: read-only for the employee -- balances are HR/system managed.
create policy leave_balances_self_select on leave_balances
  for select using (is_active_employee() and employee_id = my_employee_id());

-- payroll_records / payslips: read-only, own records only.
create policy payroll_records_self_select on payroll_records
  for select using (is_active_employee() and employee_id = my_employee_id());

create policy payslips_self_select on payslips
  for select using (
    is_active_employee()
    and payroll_record_id in (select id from payroll_records where employee_id = my_employee_id())
  );

create policy payroll_periods_employee_select on payroll_periods
  for select using (is_active_employee());

-- Shared reference data employees need to read (not sensitive; departments/
-- positions already have an equivalent public/staff split).
create policy leave_types_employee_select on leave_types
  for select using (is_active_employee());

create policy holidays_employee_select on holidays
  for select using (is_active_employee());

create policy work_schedules_employee_select on work_schedules
  for select using (is_active_employee());

create policy system_settings_employee_select on system_settings
  for select using (is_active_employee());

