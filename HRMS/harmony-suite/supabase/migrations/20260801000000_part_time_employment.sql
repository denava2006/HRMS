-- Part-time employment becomes a real distinction rather than a label.
--
-- employment_type (regular | part_time) already existed on job postings, job
-- offers, and employees, but nothing downstream knew about it: a part-time hire
-- could be put on a 9-hour shift and a full-time salary grade, and payroll would
-- pay them accordingly. The type has to reach the resources those records point
-- at before it can mean anything.
--
-- Work schedules and salary grades gain the same column, and the pairings are
-- enforced where they're stored, not only where they're chosen.

alter table public.work_schedules
  add column if not exists employment_type public.employment_type not null default 'regular';

alter table public.salary_grades
  add column if not exists employment_type public.employment_type not null default 'regular';

comment on column public.work_schedules.employment_type is
  'Which kind of employee this shift is for. Surfaced as "Schedule Type" (Full-Time / Part-Time).';
comment on column public.salary_grades.employment_type is
  'Which kind of employee this pay band is for. A part-time band and a regular band may cover the same amounts.';

-- ---------- Pay bands only clash within their own type ----------
-- The no-overlap rule was global, which was right when every grade was regular.
-- A part-time band of ₱6,000–₱10,000 and a regular band covering the same
-- amounts are not in conflict — they're never offered to the same person — so
-- the constraint is scoped by type. btree_gist supplies the `=` operator class
-- that lets an equality column join a GiST exclusion constraint.
create extension if not exists btree_gist;

alter table public.salary_grades
  drop constraint if exists salary_grades_no_overlap,
  add constraint salary_grades_no_overlap exclude using gist (
    employment_type with =,
    numrange(min_salary, max_salary, '[]') with &&
  );

-- ---------- The shifts and band the spec asks for ----------
-- Four hours, which is what "part-time" means here. The break is zero: a
-- four-hour shift doesn't carry the 60-minute meal break the full-day shifts do,
-- and leaving it at 60 would have payroll pay them for three hours.
insert into public.work_schedules (name, working_days, start_time, end_time, break_minutes, employment_type)
values
  ('Part-Time Morning',   '{1,2,3,4,5}', '08:00', '12:00', 0, 'part_time'),
  ('Part-Time Afternoon', '{1,2,3,4,5}', '13:00', '17:00', 0, 'part_time')
on conflict (name) do nothing;

insert into public.salary_grades (grade_name, min_salary, max_salary, employment_type)
values ('Grade PT-1', 6000, 10000, 'part_time')
on conflict do nothing;

-- ---------- A record may not point at resources of the other type ----------
-- Checked here rather than only in the dropdowns, so an assignment that skips
-- the UI is refused too. The messages are the ones the spec names.
create or replace function public.check_employment_type_compatibility()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_schedule_type public.employment_type;
  v_grade_type public.employment_type;
begin
  if new.work_schedule_id is not null then
    select employment_type into v_schedule_type from public.work_schedules where id = new.work_schedule_id;
    if v_schedule_type is distinct from new.employment_type then
      raise exception 'Selected work schedule is not compatible with the employee''s employment type.';
    end if;
  end if;

  if new.salary_grade_id is not null then
    select employment_type into v_grade_type from public.salary_grades where id = new.salary_grade_id;
    if v_grade_type is distinct from new.employment_type then
      raise exception 'Selected salary grade is not compatible with the employee''s employment type.';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_employees_employment_type_compatible on public.employees;
create trigger trg_employees_employment_type_compatible
  before insert or update of employment_type, work_schedule_id, salary_grade_id on public.employees
  for each row execute function public.check_employment_type_compatibility();

drop trigger if exists trg_job_offers_employment_type_compatible on public.job_offers;
create trigger trg_job_offers_employment_type_compatible
  before insert or update of employment_type, work_schedule_id, salary_grade_id on public.job_offers
  for each row execute function public.check_employment_type_compatibility();

-- Deployment records carry a schedule but no employment_type of their own — it
-- belongs to the application's job posting, which is where this reads it from.
create or replace function public.check_deployment_schedule_compatibility()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_posting_type public.employment_type;
  v_schedule_type public.employment_type;
begin
  if new.work_schedule_id is null then
    return new;
  end if;

  select jp.employment_type into v_posting_type
  from public.applications a
  join public.job_postings jp on jp.id = a.job_posting_id
  where a.id = new.application_id;

  if v_posting_type is null then
    return new;
  end if;

  select employment_type into v_schedule_type from public.work_schedules where id = new.work_schedule_id;
  if v_schedule_type is distinct from v_posting_type then
    raise exception 'Selected work schedule is not compatible with the employee''s employment type.';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_deployment_schedule_compatible on public.deployment_records;
create trigger trg_deployment_schedule_compatible
  before insert or update of work_schedule_id on public.deployment_records
  for each row execute function public.check_deployment_schedule_compatibility();

-- ---------- The type comes from the job posting ----------
-- An applicant applied to a job advertised as one thing; HR must not quietly
-- turn it into the other on the way through. The offer and the employee record
-- both take the posting's value, so this refuses a mismatch rather than
-- silently correcting it — a mismatch means someone believed the wrong thing.
create or replace function public.inherit_employment_type_from_posting()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_posting_type public.employment_type;
begin
  select jp.employment_type into v_posting_type
  from public.applications a
  join public.job_postings jp on jp.id = a.job_posting_id
  where a.id = new.application_id;

  -- No application (an employee added directly by HR) means there is no posting
  -- to inherit from, and HR's choice stands.
  if v_posting_type is null then
    return new;
  end if;

  if new.employment_type is distinct from v_posting_type then
    raise exception 'Employment type is set by the job posting (%) and cannot be changed here.', v_posting_type;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_job_offers_inherit_employment_type on public.job_offers;
create trigger trg_job_offers_inherit_employment_type
  before insert or update of employment_type on public.job_offers
  for each row execute function public.inherit_employment_type_from_posting();

drop trigger if exists trg_employees_inherit_employment_type on public.employees;
create trigger trg_employees_inherit_employment_type
  before insert or update of employment_type on public.employees
  for each row execute function public.inherit_employment_type_from_posting();
