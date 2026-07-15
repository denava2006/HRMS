-- =====================================================================
-- HARMONY SUITE HRMS — Initial Database Schema
-- =====================================================================
-- Target: PostgreSQL 15+ / Supabase
--
-- HOW TO RUN:
--   Option A (quick start): paste this whole file into the Supabase
--   Dashboard -> SQL Editor -> Run.
--   Option B (recommended): `supabase migration new initial_schema`,
--   paste this content into the generated file, then `supabase db push`.
--
-- This assumes it runs inside a Supabase project, where the `auth`
-- schema (auth.users, auth.uid()) already exists. gen_random_uuid()
-- is native to Postgres 13+ / Supabase, so no extensions are required.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------
create type user_role as enum ('admin', 'hr_staff');
create type account_status as enum ('active', 'inactive');
create type employment_type as enum ('full_time', 'part_time', 'contract', 'internship');
create type job_posting_status as enum ('draft', 'open', 'closed');
create type application_status as enum (
  'submitted', 'under_review', 'qualified', 'rejected',
  'interview_scheduled', 'offered', 'hired', 'closed'
);
create type interview_type as enum ('initial', 'final');
create type interview_status as enum ('scheduled', 'passed', 'failed', 'completed', 'cancelled');
create type offer_status as enum ('pending', 'accepted', 'declined');
create type contract_status as enum ('draft', 'printed', 'signed');
create type employment_status as enum ('active', 'on_leave', 'suspended', 'resigned', 'terminated');
create type attendance_status as enum ('present', 'absent', 'late', 'on_leave', 'holiday');
create type leave_request_status as enum ('pending', 'approved', 'rejected', 'cancelled');
create type payroll_status as enum ('draft', 'reviewed', 'released');
create type report_format as enum ('pdf', 'docx', 'excel');

-- ---------------------------------------------------------------------
-- SHARED FUNCTIONS
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================================
-- 1. USERS & ACCESS CONTROL
-- =====================================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  employee_id uuid, -- fk added below, after `employees` exists
  full_name text not null,
  email text not null unique,
  role user_role not null default 'hr_staff',
  status account_status not null default 'active',
  avatar_url text,
  last_login_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_profiles_role on profiles(role);
create index idx_profiles_status on profiles(status);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active'
  );
$$;

-- Prevents a non-admin from promoting themselves (or reviving their own
-- deactivated account) through a self profile update.
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.role is distinct from old.role or new.status is distinct from old.status then
      raise exception 'Only an administrator can change role or status.';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_prevent_self_role_escalation
before update on profiles
for each row execute function public.prevent_self_role_escalation();

-- =====================================================================
-- 2. ORGANIZATION STRUCTURE (Admin-managed)
-- =====================================================================
create table departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table positions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  department_id uuid not null references departments(id) on delete restrict,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (title, department_id)
);
create index idx_positions_department on positions(department_id);

create table salary_grades (
  id uuid primary key default gen_random_uuid(),
  grade_name text not null unique,
  min_salary numeric(12,2) not null,
  max_salary numeric(12,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (max_salary >= min_salary)
);

-- =====================================================================
-- 3. RECRUITMENT
-- =====================================================================
create table job_postings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  department_id uuid not null references departments(id),
  position_id uuid not null references positions(id),
  description text not null,
  requirements text,
  employment_type employment_type not null default 'full_time',
  vacancies integer not null default 1 check (vacancies > 0),
  status job_posting_status not null default 'draft',
  posted_by uuid references profiles(id),
  date_posted timestamptz,
  closing_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_job_postings_status on job_postings(status);
create index idx_job_postings_department on job_postings(department_id);

create table applicants (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null unique,
  phone text,
  address text,
  resume_url text,
  cover_letter text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references applicants(id) on delete cascade,
  job_posting_id uuid not null references job_postings(id) on delete cascade,
  status application_status not null default 'submitted',
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (applicant_id, job_posting_id)
);
create index idx_applications_status on applications(status);
create index idx_applications_job_posting on applications(job_posting_id);

create table interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  interview_type interview_type not null,
  scheduled_at timestamptz not null,
  interviewer_id uuid references profiles(id),
  mode text,
  location text,
  status interview_status not null default 'scheduled',
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_interviews_application on interviews(application_id);

create table job_offers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  offer_date date not null default current_date,
  proposed_salary numeric(12,2) not null,
  status offer_status not null default 'pending',
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table employment_contracts (
  id uuid primary key default gen_random_uuid(),
  job_offer_id uuid not null references job_offers(id) on delete cascade,
  contract_file_url text,
  status contract_status not null default 'draft',
  start_date date,
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- 4. EMPLOYEE MANAGEMENT
-- =====================================================================
create sequence if not exists employee_number_seq start 1;

create or replace function public.generate_employee_number()
returns text
language plpgsql
as $$
declare
  next_val bigint;
begin
  next_val := nextval('employee_number_seq');
  return 'EMP-' || to_char(current_date, 'YYYY') || '-' || lpad(next_val::text, 5, '0');
end;
$$;

create table employees (
  id uuid primary key default gen_random_uuid(),
  employee_number text not null unique default public.generate_employee_number(),
  first_name text not null,
  last_name text not null,
  email text not null unique,
  phone text,
  address text,
  birth_date date,
  gender text,
  photo_url text,
  department_id uuid references departments(id),
  position_id uuid references positions(id),
  salary_grade_id uuid references salary_grades(id),
  basic_salary numeric(12,2) not null default 0,
  employment_type employment_type not null default 'full_time',
  employment_status employment_status not null default 'active',
  hire_date date not null default current_date,
  application_id uuid references applications(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_employees_department on employees(department_id);
create index idx_employees_status on employees(employment_status);

alter table profiles
  add constraint fk_profiles_employee foreign key (employee_id) references employees(id);

create table employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  document_type text not null,
  file_url text not null,
  uploaded_by uuid references profiles(id),
  uploaded_at timestamptz not null default now()
);
create index idx_employee_documents_employee on employee_documents(employee_id);

-- =====================================================================
-- 5. ATTENDANCE
-- =====================================================================
create table attendance_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  attendance_date date not null,
  time_in timestamptz,
  time_out timestamptz,
  working_hours numeric(5,2) not null default 0,
  late_minutes integer not null default 0,
  undertime_minutes integer not null default 0,
  overtime_minutes integer not null default 0,
  status attendance_status not null default 'present',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, attendance_date)
);
create index idx_attendance_employee_date on attendance_records(employee_id, attendance_date);

-- =====================================================================
-- 6. LEAVE MANAGEMENT
-- =====================================================================
create table leave_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_credits numeric(5,2) not null default 0,
  created_at timestamptz not null default now()
);

create table leave_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  leave_type_id uuid not null references leave_types(id),
  year integer not null,
  total_credits numeric(5,2) not null default 0,
  used_credits numeric(5,2) not null default 0,
  remaining_credits numeric(5,2) generated always as (total_credits - used_credits) stored,
  updated_at timestamptz not null default now(),
  unique (employee_id, leave_type_id, year)
);

create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  leave_type_id uuid not null references leave_types(id),
  start_date date not null,
  end_date date not null,
  days_requested numeric(5,2) not null,
  reason text,
  status leave_request_status not null default 'pending',
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index idx_leave_requests_employee on leave_requests(employee_id);
create index idx_leave_requests_status on leave_requests(status);

-- =====================================================================
-- 7. PAYROLL
-- =====================================================================
create table payroll_periods (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  pay_date date,
  status payroll_status not null default 'draft',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (period_start, period_end),
  check (period_end >= period_start)
);

create table payroll_records (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references payroll_periods(id) on delete cascade,
  employee_id uuid not null references employees(id),
  basic_salary numeric(12,2) not null default 0,
  total_allowances numeric(12,2) not null default 0,
  gross_salary numeric(12,2) not null default 0,
  late_deduction numeric(12,2) not null default 0,
  undertime_deduction numeric(12,2) not null default 0,
  leave_deduction numeric(12,2) not null default 0,
  other_deductions numeric(12,2) not null default 0,
  total_deductions numeric(12,2) not null default 0,
  net_salary numeric(12,2) not null default 0,
  status payroll_status not null default 'draft',
  reviewed_by uuid references profiles(id),
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payroll_period_id, employee_id)
);
create index idx_payroll_records_period on payroll_records(payroll_period_id);
create index idx_payroll_records_employee on payroll_records(employee_id);

create table payroll_line_items (
  id uuid primary key default gen_random_uuid(),
  payroll_record_id uuid not null references payroll_records(id) on delete cascade,
  item_type text not null check (item_type in ('allowance', 'deduction')),
  label text not null,
  amount numeric(12,2) not null,
  created_at timestamptz not null default now()
);
create index idx_payroll_line_items_record on payroll_line_items(payroll_record_id);

create table payslips (
  id uuid primary key default gen_random_uuid(),
  payroll_record_id uuid not null references payroll_records(id) on delete cascade,
  file_url text,
  released_at timestamptz,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- 8. REPORTS & AUDIT
-- =====================================================================
create table generated_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null,
  filters jsonb,
  format report_format not null,
  file_url text,
  generated_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,
  table_name text not null,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);
create index idx_audit_logs_table on audit_logs(table_name);
create index idx_audit_logs_actor on audit_logs(actor_id);

-- =====================================================================
-- 9. SYSTEM SETTINGS
-- =====================================================================
create table system_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- AUTO-MAINTAIN updated_at ON EVERY TABLE THAT HAS ONE
-- =====================================================================
do $$
declare
  t text;
begin
  for t in
    select table_name from information_schema.columns
    where column_name = 'updated_at' and table_schema = 'public'
  loop
    execute format(
      'create trigger trg_set_updated_at before update on public.%I for each row execute function public.set_updated_at();',
      t
    );
  end loop;
end;
$$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

-- ---- profiles: special-cased identity table ----
alter table profiles enable row level security;
create policy profiles_staff_select_all on profiles for select using (is_active_staff());
create policy profiles_self_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_manage on profiles for all using (is_admin()) with check (is_admin());

-- ---- Group 1: admin-managed reference/config data ----
-- staff can read, only admins can create/edit/delete
do $$
declare
  t text;
begin
  foreach t in array array['departments','positions','salary_grades','leave_types','system_settings']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('create policy %I_staff_select on public.%I for select using (is_active_staff());', t, t);
    execute format('create policy %I_admin_manage on public.%I for all using (is_admin()) with check (is_admin());', t, t);
  end loop;
end;
$$;

-- ---- Group 2: operational HR data — any active staff can fully manage ----
do $$
declare
  t text;
begin
  foreach t in array array[
    'job_postings','applicants','applications','interviews','job_offers',
    'employment_contracts','employee_documents','leave_requests',
    'leave_balances','generated_reports'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('create policy %I_staff_all on public.%I for all using (is_active_staff()) with check (is_active_staff());', t, t);
  end loop;
end;
$$;

-- ---- Group 3: sensitive/historical records — staff read & write,
--      hard DELETE is admin-only (use status fields instead of deleting) ----
do $$
declare
  t text;
begin
  foreach t in array array[
    'employees','attendance_records','payroll_periods',
    'payroll_records','payroll_line_items','payslips'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('create policy %I_staff_select on public.%I for select using (is_active_staff());', t, t);
    execute format('create policy %I_staff_insert on public.%I for insert with check (is_active_staff());', t, t);
    execute format('create policy %I_staff_update on public.%I for update using (is_active_staff()) with check (is_active_staff());', t, t);
    execute format('create policy %I_admin_delete on public.%I for delete using (is_admin());', t, t);
  end loop;
end;
$$;

-- ---- Group 4: audit_logs — admin can view; inserts happen via a
--      SECURITY DEFINER trigger added when we build the Admin module ----
alter table audit_logs enable row level security;
create policy audit_logs_admin_select on audit_logs for select using (is_admin());

-- =====================================================================
-- SEED DATA (starter values only — safe to edit or remove)
-- =====================================================================
insert into leave_types (name, default_credits) values
  ('Vacation Leave', 15),
  ('Sick Leave', 15),
  ('Emergency Leave', 5)
on conflict (name) do nothing;

insert into system_settings (key, value) values
  ('company_name', '"Your Company Name"'),
  ('timezone', '"Asia/Manila"'),
  ('currency', '"PHP"')
on conflict (key) do nothing;
