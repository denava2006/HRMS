-- Recruitment screening becomes the HR Manager's decision.
--
-- Every HR role could previously mark an application Qualified or Rejected, so
-- HR Staff both prepared the work and approved it — the same thing the payroll
-- and leave gates were added to stop. Screening is an approval, so it moves to
-- the HR Manager, and Recruitment becomes their module the way Job Posting is
-- HR Staff's (20260729080000_job_postings_hr_staff_only.sql).
--
-- HR Staff loses nothing downstream: Interview Management reads qualified
-- applicants directly, so they pick the pipeline straight back up.
--
-- Enforced with a BEFORE UPDATE trigger rather than by narrowing the broad
-- applications_staff_all policy, matching protect_leave_approval() and
-- protect_payroll_approval(). The message is user-facing — it surfaces through
-- the mutation's onError toast.
create or replace function public.protect_application_screening()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if old.status = 'submitted'
     and new.status in ('qualified','rejected')
     and not public.is_hr_manager_or_admin() then
    raise exception 'Only an HR Manager can qualify or reject an application.';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_protect_application_screening on public.applications;
create trigger trg_protect_application_screening
  before update on public.applications
  for each row execute function public.protect_application_screening();
