-- Recruitment (application screening) module: HR needs structured review
-- fields beyond the single free-text `notes` column, a distinct rejection
-- reason (separate concern from general review notes), and a real activity
-- timeline per application (submitted/reviewed/qualified/rejected) rather
-- than overloading reviewed_at/updated_at to represent multiple distinct
-- lifecycle events.

alter table public.applications
  add column education text,
  add column work_experience text,
  add column skills text,
  add column certifications text,
  add column overall_assessment text,
  add column rejection_reason text;

create table public.application_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  event text not null check (event in ('submitted', 'reviewed', 'qualified', 'rejected', 'rejection_email_queued')),
  notes text,
  actor_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index idx_application_history_application on public.application_history(application_id, created_at);

alter table public.application_history enable row level security;
-- Same "any active staff can fully manage" pattern as applications/applicants
-- (Group 2 in the original schema) — history is part of the same operational
-- HR workflow. No anon policy: the public submit_job_application RPC is
-- SECURITY DEFINER and inserts the 'submitted' event directly, bypassing RLS,
-- so applicants never need direct access to this table.
create policy application_history_staff_all on public.application_history
  for all using (is_active_staff()) with check (is_active_staff());

-- Log the 'submitted' event as part of the same atomic transaction that
-- creates the application, so the timeline's first entry is never missing.
create or replace function public.submit_job_application(
  p_job_posting_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_address text,
  p_resume_path text,
  p_cover_letter text default null
)
returns table (application_id uuid, applicant_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status job_posting_status;
  v_closing_date date;
  v_applicant_id uuid;
  v_application_id uuid;
begin
  select status, closing_date into v_status, v_closing_date
  from job_postings
  where id = p_job_posting_id;

  if not found then
    raise exception 'JOB_NOT_FOUND';
  end if;

  if v_status <> 'open' or (v_closing_date is not null and v_closing_date < current_date) then
    raise exception 'JOB_CLOSED';
  end if;

  select id into v_applicant_id from applicants where email = p_email;

  if v_applicant_id is null then
    insert into applicants (first_name, last_name, email, phone, address, resume_url, cover_letter)
    values (p_first_name, p_last_name, p_email, p_phone, p_address, p_resume_path, p_cover_letter)
    returning id into v_applicant_id;
  else
    if exists (
      select 1 from applications
      where applications.applicant_id = v_applicant_id and applications.job_posting_id = p_job_posting_id
    ) then
      raise exception 'DUPLICATE_APPLICATION';
    end if;

    update applicants
    set first_name = p_first_name,
        last_name = p_last_name,
        phone = p_phone,
        address = p_address,
        resume_url = p_resume_path,
        cover_letter = coalesce(p_cover_letter, cover_letter),
        updated_at = now()
    where id = v_applicant_id;
  end if;

  insert into applications (applicant_id, job_posting_id)
  values (v_applicant_id, p_job_posting_id)
  returning id into v_application_id;

  insert into application_history (application_id, event)
  values (v_application_id, 'submitted');

  return query select v_application_id, v_applicant_id;
end;
$$;

