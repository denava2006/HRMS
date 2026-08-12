-- The applicant's tracking page went dark after the job offer. Everything HR
-- did next — draft and sign the employment contract, complete the deployment,
-- create the employee record, create the login — happened without the person
-- it was all about ever seeing a copy. They accepted an offer and then had to
-- wait for someone to email them their own onboarding details.
--
-- lookup_application now returns the whole downstream trail: contract, the
-- deployment posting, the employee record that was created from it, whether a
-- login exists (and under which email), and the list of documents on file.
--
-- What is deliberately NOT returned: the account password (HR hands that over
-- directly), internal remarks that name HR staff, and any storage object
-- itself — file paths are returned so the applicant can request a short-lived
-- signed URL through the applicant-file Edge Function, which re-checks the
-- reference-code + email pairing before signing anything.

drop function if exists public.lookup_application(text, text);

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

-- ---- Ownership check for the file-download Edge Function ----
-- The Edge Function holds the service_role key and could sign a URL for any
-- object in the bucket, so the "does this path actually belong to this
-- applicant?" decision is made here, in SQL, against the same reference-code +
-- email pairing every other applicant entry point uses.
create or replace function public.applicant_owns_file(
  p_reference_code text,
  p_email text,
  p_bucket text,
  p_path text
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.applications a
    join public.applicants ap on ap.id = a.applicant_id
    left join public.job_offers o on o.application_id = a.id
    left join public.employment_contracts c on c.job_offer_id = o.id
    left join public.employees e on e.application_id = a.id
    left join public.employee_documents ed on ed.employee_id = e.id
    where a.reference_code = upper(trim(p_reference_code))
      and lower(ap.email) = lower(trim(p_email))
      and (
        (p_bucket = 'contracts' and c.contract_file_url = p_path)
        or (p_bucket = 'employee-documents' and ed.file_url = p_path)
      )
  );
$function$;

revoke execute on function public.applicant_owns_file(text, text, text, text) from public, anon, authenticated;
grant execute on function public.applicant_owns_file(text, text, text, text) to service_role;
