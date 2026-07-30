-- Payroll approval becomes a per-employee decision with a real return path.
--
-- Before: one "Review & Approve" button flipped every record in the period at
-- once, and there was no way to send a single wrong record back. An HR Manager
-- who spotted a missing late deduction on one employee could only approve
-- everything or nothing.
--
-- The workflow the spec asks for:
--
--   draft -> generated -> pending_approval -> approved -> released
--                              ^                  |
--                              |                  v
--                              +--- edited <-- rejected
--
-- Each payroll_record walks that path on its own. The period's status is an
-- aggregate of its records, maintained by trigger so existing period-level
-- queries keep working without every caller learning the new rules.

-- ---------- payroll_status gains the states the workflow needs ----------
-- 'reviewed' becomes 'approved' — same meaning, the name the spec uses.
-- Postgres has no DROP VALUE, so the type is rebuilt. Two RLS policies name
-- 'released' explicitly and have to be dropped and restored around it.
drop policy if exists payroll_records_self_select on public.payroll_records;
drop policy if exists payslips_self_select on public.payslips;

drop trigger if exists trg_protect_payroll_period_approval on public.payroll_periods;
drop trigger if exists trg_protect_payroll_record_approval on public.payroll_records;

create type public.payroll_status_new as enum (
  'draft', 'generated', 'pending_approval', 'approved', 'rejected', 'released'
);

alter table public.payroll_periods alter column status drop default;
alter table public.payroll_records alter column status drop default;

alter table public.payroll_periods
  alter column status type public.payroll_status_new
  using (case status::text when 'reviewed' then 'approved' else status::text end)::public.payroll_status_new;
alter table public.payroll_records
  alter column status type public.payroll_status_new
  using (case status::text when 'reviewed' then 'approved' else status::text end)::public.payroll_status_new;

drop type public.payroll_status;
alter type public.payroll_status_new rename to payroll_status;

alter table public.payroll_periods alter column status set default 'draft'::public.payroll_status;
alter table public.payroll_records alter column status set default 'draft'::public.payroll_status;

-- Employees still see only what has actually been released to them.
create policy payroll_records_self_select on public.payroll_records
  for select using (
    public.is_active_employee()
    and employee_id = public.my_employee_id()
    and status = 'released'::public.payroll_status
  );

create policy payslips_self_select on public.payslips
  for select using (
    public.is_active_employee()
    and payroll_record_id in (
      select id from public.payroll_records
      where employee_id = public.my_employee_id()
        and status = 'released'::public.payroll_status
    )
  );

-- ---------- Who did what, and why ----------
-- §13 asks every approval and rejection to record who requested it, who
-- reviewed it, when, and the reason. reviewed_by already existed; the rest
-- were nowhere, so a rejected payroll arrived back at HR Staff with no
-- explanation attached to it.
alter table public.payroll_records
  add column if not exists submitted_by uuid references public.profiles(id),
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists rejection_reason text;

-- ---------- Role gates ----------
-- Submitting for approval is HR Staff preparing work. Approving, rejecting,
-- and releasing are the HR Manager's calls. Enforced in a trigger rather than
-- by narrowing the broad *_staff_all policies, matching the existing
-- protect_leave_approval() precedent — and meaning a direct API call is
-- refused the same way the UI is.
create or replace function public.protect_payroll_approval()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status is distinct from old.status
     and new.status in ('approved','rejected','released')
     and not public.is_hr_manager_or_admin() then
    raise exception 'Only an HR Manager can approve, reject, or release payroll.';
  end if;
  return new;
end;
$function$;

create trigger trg_protect_payroll_period_approval
  before update on public.payroll_periods
  for each row execute function public.protect_payroll_approval();

create trigger trg_protect_payroll_record_approval
  before update on public.payroll_records
  for each row execute function public.protect_payroll_approval();

-- A rejection without a reason is just a record that moved backwards for no
-- stated cause, which is exactly what HR Staff can't act on.
create or replace function public.require_payroll_rejection_reason()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.status = 'rejected' and coalesce(trim(new.rejection_reason), '') = '' then
    raise exception 'A reason is required when rejecting payroll.';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_require_payroll_rejection_reason on public.payroll_records;
create trigger trg_require_payroll_rejection_reason
  before update on public.payroll_records
  for each row execute function public.require_payroll_rejection_reason();

-- ---------- The period follows its records ----------
-- Callers still ask "what state is this payroll period in?", so rather than
-- make all of them aggregate by hand, the period's own status is recomputed
-- whenever a record moves. The order below is a priority list, not a set:
-- one rejected record holds the whole period at 'rejected' because that's the
-- state HR Staff has to act on.
create or replace function public.recompute_payroll_period_status(p_period_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_total int;
  v_released int;
  v_approved int;
  v_pending int;
  v_rejected int;
  v_status public.payroll_status;
begin
  select count(*),
         count(*) filter (where status = 'released'),
         count(*) filter (where status = 'approved'),
         count(*) filter (where status = 'pending_approval'),
         count(*) filter (where status = 'rejected')
    into v_total, v_released, v_approved, v_pending, v_rejected
  from public.payroll_records
  where payroll_period_id = p_period_id;

  if v_total = 0 then
    v_status := 'draft';
  elsif v_released = v_total then
    v_status := 'released';
  elsif v_rejected > 0 then
    v_status := 'rejected';
  elsif v_pending > 0 then
    v_status := 'pending_approval';
  elsif v_approved + v_released = v_total then
    v_status := 'approved';
  else
    v_status := 'generated';
  end if;

  update public.payroll_periods set status = v_status where id = p_period_id and status is distinct from v_status;
end;
$function$;

create or replace function public.sync_payroll_period_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform public.recompute_payroll_period_status(coalesce(new.payroll_period_id, old.payroll_period_id));
  return null;
end;
$function$;

drop trigger if exists trg_sync_payroll_period_status on public.payroll_records;
create trigger trg_sync_payroll_period_status
  after insert or update of status or delete on public.payroll_records
  for each row execute function public.sync_payroll_period_status();

-- Bring existing periods in line.
do $$
declare r record;
begin
  for r in select id from public.payroll_periods loop
    perform public.recompute_payroll_period_status(r.id);
  end loop;
end $$;
