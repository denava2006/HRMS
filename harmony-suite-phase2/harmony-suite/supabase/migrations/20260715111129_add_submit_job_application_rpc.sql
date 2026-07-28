-- Public application submissions need server-side enforcement that plain
-- anon INSERT policies can't provide: reusing an existing applicant record
-- by email (anon has no SELECT on applicants/applications, by design, so
-- PII isn't readable by the public), rejecting applications to closed/
-- past-closing-date postings, and preventing the same email from applying
-- twice to the same posting — all atomically, in one round trip.
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
      where applicant_id = v_applicant_id and job_posting_id = p_job_posting_id
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

  return query select v_application_id, v_applicant_id;
end;
$$;

revoke all on function public.submit_job_application(uuid, text, text, text, text, text, text, text) from public;
grant execute on function public.submit_job_application(uuid, text, text, text, text, text, text, text) to anon, authenticated;

