-- Extend the job_offers scaffold with the fields the Job Offer form needs.
-- Position/Department are not duplicated here — they're already reachable via
-- application -> job_posting -> position/department, same pattern as Interview
-- Management.
alter table public.job_offers
  add column employment_type employment_type not null default 'full_time',
  add column salary_grade_id uuid references public.salary_grades(id),
  add column currency text not null default 'PHP' check (currency in ('PHP', 'USD')),
  add column working_hours text,
  add column working_days text,
  add column start_date date,
  add column probation_period text,
  add column benefits text,
  add column additional_compensation text,
  add column notes text,
  add column prepared_by uuid references public.profiles(id);

-- Extend employment_contracts with the content fields Step 3/4/5 need.
alter table public.employment_contracts
  add column company_policies text,
  add column terms text,
  add column additional_notes text,
  add column signed_by uuid references public.profiles(id),
  add column signing_notes text;

create table public.deployment_records (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications(id) on delete cascade,
  deployment_date date not null,
  reporting_manager text,
  assigned_branch text,
  employment_status employment_status not null default 'active',
  work_location text,
  reporting_time text,
  remarks text,
  deployed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deployment_records enable row level security;

create policy deployment_records_staff_all on public.deployment_records
  for all
  using (is_active_staff())
  with check (is_active_staff());

create trigger trg_set_updated_at
  before update on public.deployment_records
  for each row execute function set_updated_at();

-- Marks that a hired applicant has moved into the Deployment module's
-- ownership (mirrors how 'interview_scheduled' marks Interview Management's
-- ownership) — set once a job offer is prepared, stays through the whole
-- offer/contract/signing flow, and becomes the terminal state once deployed.
alter type public.application_status add value 'deployed';

alter table public.application_history drop constraint application_history_event_check;
alter table public.application_history add constraint application_history_event_check
  check (event = any (array[
    'submitted', 'reviewed', 'qualified', 'rejected', 'rejection_email_queued',
    'initial_interview_scheduled', 'initial_interview_started', 'initial_interview_passed', 'initial_interview_rejected',
    'final_interview_scheduled', 'final_interview_started', 'final_interview_rejected', 'hired',
    'interview_scheduled_email_queued', 'hired_email_queued',
    'job_offer_prepared', 'offer_accepted', 'offer_declined', 'application_closed',
    'contract_prepared', 'contract_generated', 'contract_signed', 'deployment_completed'
  ]));

alter table public.job_offers replica identity full;
alter table public.employment_contracts replica identity full;
alter table public.deployment_records replica identity full;
alter publication supabase_realtime add table public.job_offers;
alter publication supabase_realtime add table public.employment_contracts;
alter publication supabase_realtime add table public.deployment_records;
