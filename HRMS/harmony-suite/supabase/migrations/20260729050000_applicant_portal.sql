-- Applicant self-service portal.
--
-- Applicants previously had no way to see where their application stood, and
-- HR clicked "Accept Offer"/"Decline Offer" on the candidate's behalf — a
-- decision that isn't HR's to make. This gives each application a reference
-- code the applicant can use, with their own email, to track it and respond to
-- their own job offer.
--
-- Applicants are not Supabase Auth users, so every entry point here is a
-- SECURITY DEFINER RPC that requires BOTH the reference code and the email the
-- application was submitted with. Codes are sequential and therefore guessable;
-- pairing them with the email is what stops one applicant from reading — or
-- responding to an offer belonging to — another. The `anon` role is granted
-- EXECUTE on these functions only, never direct table access.

create sequence if not exists application_reference_seq;

create or replace function public.generate_application_reference()
returns text
language plpgsql
set search_path to 'public'
as $function$
declare next_val bigint;
begin
  next_val := nextval('application_reference_seq');
  return 'APP-' || to_char(current_date, 'YYYY') || '-' || lpad(next_val::text, 4, '0');
end;
$function$;

alter table public.applications
  add column reference_code text unique default public.generate_application_reference();

-- Backfill any application that predates this column.
update public.applications
set reference_code = public.generate_application_reference()
where reference_code is null;

alter table public.applications alter column reference_code set not null;

-- ---- Lookup: status + interview + offer for one application ----
-- Returns a single row (or none). Deliberately exposes only what the applicant
-- needs to see — no internal notes, ratings, rejection reasons, or reviewer
-- identities.
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
  offer_additional_compensation text
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
    o.additional_compensation
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
  where a.reference_code = upper(trim(p_reference_code))
    and lower(ap.email) = lower(trim(p_email));
$function$;

-- ---- Respond to a job offer ----
-- The applicant's own accept/decline. Mirrors what useRespondToOffer did on
-- the HR side: stamps the offer, and a decline closes the application.
create or replace function public.respond_to_job_offer(
  p_reference_code text,
  p_email text,
  p_decision text
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_application_id uuid;
  v_offer_id uuid;
  v_offer_status public.offer_status;
begin
  if p_decision not in ('accepted','declined') then
    raise exception 'INVALID_DECISION';
  end if;

  select a.id into v_application_id
  from public.applications a
  join public.applicants ap on ap.id = a.applicant_id
  where a.reference_code = upper(trim(p_reference_code))
    and lower(ap.email) = lower(trim(p_email));

  if v_application_id is null then
    raise exception 'NOT_FOUND';
  end if;

  select id, status into v_offer_id, v_offer_status
  from public.job_offers
  where application_id = v_application_id
  order by created_at desc limit 1;

  if v_offer_id is null then
    raise exception 'NO_OFFER';
  end if;

  if v_offer_status <> 'pending' then
    raise exception 'ALREADY_RESPONDED';
  end if;

  update public.job_offers
  set status = p_decision::public.offer_status, responded_at = now()
  where id = v_offer_id;

  if p_decision = 'declined' then
    update public.applications set status = 'closed' where id = v_application_id;
    insert into public.application_history (application_id, event, notes)
    values (v_application_id, 'offer_declined', 'Declined by the applicant via the tracking portal.'),
           (v_application_id, 'application_closed', null);
  else
    insert into public.application_history (application_id, event, notes)
    values (v_application_id, 'offer_accepted', 'Accepted by the applicant via the tracking portal.');
  end if;

  return p_decision;
end;
$function$;

-- Applicants hit these as `anon`. EXECUTE on the two RPCs is the entire public
-- surface — no direct table privileges are granted.
revoke execute on function public.lookup_application(text, text) from public;
revoke execute on function public.respond_to_job_offer(text, text, text) from public;
grant execute on function public.lookup_application(text, text) to anon, authenticated;
grant execute on function public.respond_to_job_offer(text, text, text) to anon, authenticated;

revoke execute on function public.generate_application_reference() from public, anon, authenticated;

-- submit_job_application now returns the reference code too, so the success
-- screen can show the applicant how to get back in.
drop function if exists public.submit_job_application(uuid, text, text, text, text, text, text, text, text);

create or replace function public.submit_job_application(
  p_job_posting_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_address text,
  p_resume_path text,
  p_cover_letter text default null,
  p_middle_name text default null
)
returns table(application_id uuid, applicant_id uuid, reference_code text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_status job_posting_status;
  v_closing_date date;
  v_applicant_id uuid;
  v_application_id uuid;
  v_reference_code text;
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
    insert into applicants (first_name, middle_name, last_name, email, phone, address, resume_url, cover_letter)
    values (p_first_name, p_middle_name, p_last_name, p_email, p_phone, p_address, p_resume_path, p_cover_letter)
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
        middle_name = p_middle_name,
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
  returning id, applications.reference_code into v_application_id, v_reference_code;

  insert into application_history (application_id, event)
  values (v_application_id, 'submitted');

  return query select v_application_id, v_applicant_id, v_reference_code;
end;
$function$;
