-- submit_job_application carries the address parts through.
--
-- The applicant form now collects province, city, and barangay from the
-- location list rather than as free text (see 20260731100000), so the RPC that
-- creates the applicant has to store them. `p_address` narrows to the street
-- line it always should have been.
--
-- The parts are optional in the signature so an application submitted from an
-- older client still lands rather than erroring; the form itself requires them.

create or replace function public.submit_job_application(
  p_job_posting_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_address text,
  p_resume_path text,
  p_cover_letter text default null,
  p_middle_name text default null,
  p_province text default null,
  p_city text default null,
  p_barangay text default null
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
    insert into applicants (
      first_name, middle_name, last_name, email, phone,
      address, province, city, barangay, resume_url, cover_letter
    )
    values (
      p_first_name, p_middle_name, p_last_name, p_email, p_phone,
      p_address, p_province, p_city, p_barangay, p_resume_path, p_cover_letter
    )
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
        province = coalesce(p_province, province),
        city = coalesce(p_city, city),
        barangay = coalesce(p_barangay, barangay),
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

-- The nine-argument signature would otherwise still resolve and silently drop
-- the address parts.
drop function if exists public.submit_job_application(uuid, text, text, text, text, text, text, text, text);

revoke execute on function public.submit_job_application(uuid, text, text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.submit_job_application(uuid, text, text, text, text, text, text, text, text, text, text, text) to anon, authenticated;

-- ---------- The applicant's address travels with them ----------
-- lookup_application already returns the applicant's own details; the employee
-- record created from an application should inherit the split address too,
-- rather than making HR retype what the applicant already picked.
create or replace function public.applicant_address_parts(p_application_id uuid)
returns table (province text, city text, barangay text, street text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select ap.province, ap.city, ap.barangay, ap.address
  from public.applications a
  join public.applicants ap on ap.id = a.applicant_id
  where a.id = p_application_id;
$function$;

revoke execute on function public.applicant_address_parts(uuid) from public, anon;
grant execute on function public.applicant_address_parts(uuid) to authenticated;
