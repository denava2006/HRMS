-- Employment Status and Employment Type had grown into each other.
--
-- employment_status held (active, regular, contractual, temporary, on_leave,
-- resigned, terminated, retired) — three of those describe what *kind* of
-- employment someone has, not whether they are currently working. Meanwhile
-- employment_type held (full_time, part_time). So "regular" was a status and
-- "full_time" was a type, and nothing stopped an employee being both "regular"
-- and "full_time" at once, meaning the same fact twice.
--
-- After this migration:
--   employment_status = active | on_leave | resigned | terminated | retired
--   employment_type   = regular | part_time
--
-- Postgres has no DROP VALUE for enums, so each type is rebuilt: create the new
-- type, move the columns across with an explicit USING map, drop the old type,
-- rename. Defaults have to come off first — a default expression pins the old
-- type and blocks the ALTER.

-- lookup_application declares both enums in its RETURNS TABLE, which pins the
-- old types. Dropped here and recreated verbatim at the bottom once the new
-- types exist under the same names.
drop function if exists public.lookup_application(text, text);

-- ---------- employment_type: full_time -> regular ----------
create type public.employment_type_new as enum ('regular', 'part_time');

alter table public.employees alter column employment_type drop default;
alter table public.job_postings alter column employment_type drop default;
alter table public.job_offers alter column employment_type drop default;

alter table public.employees
  alter column employment_type type public.employment_type_new
  using (case employment_type::text when 'full_time' then 'regular' else 'part_time' end)::public.employment_type_new;
alter table public.job_postings
  alter column employment_type type public.employment_type_new
  using (case employment_type::text when 'full_time' then 'regular' else 'part_time' end)::public.employment_type_new;
alter table public.job_offers
  alter column employment_type type public.employment_type_new
  using (case employment_type::text when 'full_time' then 'regular' else 'part_time' end)::public.employment_type_new;

drop type public.employment_type;
alter type public.employment_type_new rename to employment_type;

alter table public.employees alter column employment_type set default 'regular'::public.employment_type;
alter table public.job_postings alter column employment_type set default 'regular'::public.employment_type;
alter table public.job_offers alter column employment_type set default 'regular'::public.employment_type;

-- ---------- employment_status: drop the three type-shaped values ----------
-- regular/contractual/temporary all described people who are working, so they
-- collapse to 'active'. Nobody loses their employment kind: it now lives in
-- employment_type, which HR sets when completing the employee record.
create type public.employment_status_new as enum ('active', 'on_leave', 'resigned', 'terminated', 'retired');

alter table public.employees alter column employment_status drop default;
alter table public.employees
  alter column employment_status type public.employment_status_new
  using (case employment_status::text
           when 'regular' then 'active'
           when 'contractual' then 'active'
           when 'temporary' then 'active'
           else employment_status::text
         end)::public.employment_status_new;

drop type public.employment_status;
alter type public.employment_status_new rename to employment_status;
alter table public.employees alter column employment_status set default 'active'::public.employment_status;

-- ---------- Leaving the company disables the login ----------
-- Resigned, terminated, and retired people keep their employee record (payroll
-- history, attendance, documents all reference it) but must not be able to sign
-- in. AuthContext already refuses a profile that isn't active, so flipping the
-- profile is all that's needed — and doing it in a trigger means it happens
-- however the status was changed, including a direct API call.
create or replace function public.sync_account_with_employment_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.employment_status is distinct from old.employment_status then
    if new.employment_status in ('resigned','terminated','retired') then
      update public.profiles set status = 'inactive' where employee_id = new.id and status <> 'inactive';
    elsif new.employment_status in ('active','on_leave') then
      -- Reinstating someone (a correction, or a rehire) has to give the login
      -- back too, otherwise the only way out of a mistaken termination is an
      -- administrator editing the profile by hand.
      update public.profiles set status = 'active' where employee_id = new.id and status <> 'active';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_sync_account_with_employment_status on public.employees;
create trigger trg_sync_account_with_employment_status
  after update on public.employees
  for each row execute function public.sync_account_with_employment_status();

-- ---------- "On Leave" is decided by the system, not typed in ----------
-- An employee is On Leave when an approved leave request covers today, and goes
-- back to Active on its own once that period ends. People who have left the
-- company are never touched — resigned is not a state you leave by taking a
-- day off.
create or replace function public.sync_employment_statuses()
returns void
language sql
security definer
set search_path to 'public'
as $function$
  with covered as (
    select distinct employee_id
    from public.leave_requests
    where status = 'approved'
      and start_date <= current_date
      and end_date >= current_date
  )
  update public.employees e
  set employment_status = case when c.employee_id is null then 'active' else 'on_leave' end::public.employment_status
  from (select id from public.employees) ids
  left join covered c on c.employee_id = ids.id
  where e.id = ids.id
    and e.employment_status in ('active','on_leave')
    and e.employment_status <> (case when c.employee_id is null then 'active' else 'on_leave' end)::public.employment_status;
$function$;

revoke execute on function public.sync_employment_statuses() from public;
grant execute on function public.sync_employment_statuses() to authenticated;

-- Approving or editing a leave request should flip the badge immediately
-- rather than waiting for the next reconcile.
create or replace function public.sync_statuses_after_leave_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform public.sync_employment_statuses();
  return null;
end;
$function$;

drop trigger if exists trg_sync_statuses_after_leave_change on public.leave_requests;
create trigger trg_sync_statuses_after_leave_change
  after insert or update of status, start_date, end_date on public.leave_requests
  for each statement execute function public.sync_statuses_after_leave_change();

-- Bring existing rows in line with the new rules.
select public.sync_employment_statuses();

-- ---------- Recreate the applicant lookup against the rebuilt enums ----------
create or replace function public.lookup_application(
  p_reference_code text,
  p_email text
)
returns table (
  reference_code text,
  status public.application_status,
  submitted_at timestamptz,
  applicant_name text,
  position_title text,
  department_name text,
  interview_type public.interview_type,
  interview_scheduled_at timestamptz,
  interview_mode text,
  interview_location text,
  interview_meeting_link text,
  interview_status public.interview_status,
  offer_id uuid,
  offer_status public.offer_status,
  offer_employment_type public.employment_type,
  offer_salary numeric,
  offer_currency text,
  offer_start_date date,
  offer_working_hours text,
  offer_working_days text,
  offer_benefits text,
  offer_additional_compensation text,
  contract_id uuid,
  contract_status public.contract_status,
  contract_start_date date,
  contract_signed_at timestamptz,
  contract_file_path text,
  contract_company_policies text,
  contract_terms text,
  contract_additional_notes text,
  deployment_date date,
  deployment_branch text,
  deployment_work_location text,
  deployment_schedule_name text,
  deployment_schedule_start time,
  deployment_schedule_end time,
  deployment_schedule_days smallint[],
  deployment_remarks text,
  employee_number text,
  employee_email text,
  employee_hire_date date,
  employee_position text,
  employee_department text,
  employee_basic_salary numeric,
  employee_currency text,
  employee_employment_type public.employment_type,
  employee_employment_status public.employment_status,
  employee_benefits text,
  account_email text,
  account_activated_at timestamptz,
  documents jsonb
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    a.reference_code,
    a.status,
    a.created_at,
    concat_ws(' ', ap.first_name, ap.last_name),
    pos.title,
    dep.name,
    i.interview_type,
    i.scheduled_at,
    i.mode,
    i.location,
    i.meeting_link,
    i.status,
    o.id,
    o.status,
    o.employment_type,
    o.proposed_salary,
    o.currency,
    o.start_date,
    o.working_hours,
    o.working_days,
    o.benefits,
    o.additional_compensation,
    c.id,
    c.status,
    c.start_date,
    c.signed_at,
    c.contract_file_url,
    c.company_policies,
    c.terms,
    c.additional_notes,
    d.deployment_date,
    coalesce(br.name, d.assigned_branch),
    coalesce(wl.name, d.work_location),
    ws.name,
    ws.start_time,
    ws.end_time,
    ws.working_days,
    d.remarks,
    e.employee_number,
    e.email,
    e.hire_date,
    epos.title,
    edep.name,
    e.basic_salary,
    e.currency,
    e.employment_type,
    e.employment_status,
    e.benefits,
    pr.email,
    pr.activated_at,
    coalesce(docs.items, '[]'::jsonb)
  from public.applications a
  join public.applicants ap on ap.id = a.applicant_id
  left join public.job_postings jp on jp.id = a.job_posting_id
  left join public.positions pos on pos.id = jp.position_id
  left join public.departments dep on dep.id = jp.department_id
  -- Only the interview the applicant still needs to attend, newest first.
  left join lateral (
    select * from public.interviews
    where application_id = a.id and status in ('scheduled','completed')
    order by scheduled_at desc limit 1
  ) i on true
  left join lateral (
    select * from public.job_offers
    where application_id = a.id
    order by created_at desc limit 1
  ) o on true
  left join lateral (
    select * from public.employment_contracts
    where job_offer_id = o.id
    order by created_at desc limit 1
  ) c on true
  left join public.deployment_records d on d.application_id = a.id
  left join public.branches br on br.id = d.branch_id
  left join public.work_locations wl on wl.id = d.work_location_id
  left join public.work_schedules ws on ws.id = d.work_schedule_id
  left join public.employees e on e.application_id = a.id
  left join public.positions epos on epos.id = e.position_id
  left join public.departments edep on edep.id = e.department_id
  left join public.profiles pr on pr.employee_id = e.id
  left join lateral (
    select jsonb_agg(
             jsonb_build_object(
               'document_type', ed.document_type,
               'file_path', ed.file_url,
               'uploaded_at', ed.uploaded_at
             ) order by ed.uploaded_at
           ) as items
    from public.employee_documents ed
    where ed.employee_id = e.id
  ) docs on true
  where a.reference_code = upper(trim(p_reference_code))
    and lower(ap.email) = lower(trim(p_email));
$function$;

revoke execute on function public.lookup_application(text, text) from public;
grant execute on function public.lookup_application(text, text) to anon, authenticated;

revoke execute on function public.lookup_application(text, text) from public;
grant execute on function public.lookup_application(text, text) to anon, authenticated;
