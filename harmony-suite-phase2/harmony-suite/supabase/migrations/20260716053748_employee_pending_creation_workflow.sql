
-- Middle name now collected at the point of application so it carries through
-- Application -> Recruitment -> Interview -> Deployment -> Employee without HR
-- ever re-typing it.
alter table applicants add column middle_name text;

-- Prevents the same application from ever backing two employee records
-- (e.g. a double-submit of the Create Employee wizard from a pending row).
alter table employees add constraint employees_application_id_key unique (application_id);

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
returns table(application_id uuid, applicant_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  returning id into v_application_id;

  insert into application_history (application_id, event)
  values (v_application_id, 'submitted');

  return query select v_application_id, v_applicant_id;
end;
$function$;

-- Employee-driven account activation (SetupPasswordPage) runs as the newly
-- authenticated employee, whose role can never satisfy audit_logs_staff_insert's
-- is_active_staff() check -- a SECURITY DEFINER trigger is the only way to record
-- it, matching the same pattern already used for is_admin()/is_active_staff().
create or replace function public.handle_employee_account_activated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.activated_at is null and new.activated_at is not null and new.employee_id is not null then
    insert into audit_logs (actor_id, action, table_name, record_id)
    values (new.id, 'Employee Activated Account', 'employees', new.employee_id);
    insert into employee_history (employee_id, event, actor_id)
    values (new.employee_id, 'account_activated', new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists on_employee_account_activated on profiles;
create trigger on_employee_account_activated
  after update on profiles
  for each row
  execute function public.handle_employee_account_activated();

