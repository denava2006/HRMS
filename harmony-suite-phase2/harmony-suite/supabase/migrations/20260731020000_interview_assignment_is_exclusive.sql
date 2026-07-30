-- An applicant handed to a specific HR Manager belongs to that manager only.
--
-- final_interviewer_id already decided who *may act* on the final interview
-- (20260729030000). What was still open was reading: every HR Manager could
-- see every other manager's assigned applicant and their evaluation notes, and
-- HR Staff kept the applicant in their own Interview Management queue after
-- handing them over, so two people were looking at a queue only one of them
-- could act on.
--
-- Reading a final interview is now scoped the same way acting on it is.

drop policy if exists interviews_select_staff on public.interviews;

create policy interviews_select_staff on public.interviews
  for select using (
    is_active_staff()
    and (
      -- Initial interviews stay visible to all of HR: that's the round HR Staff
      -- runs and hands off from, and its evaluation is the reason a particular
      -- manager was nominated.
      interview_type = 'initial'::interview_type
      -- A final interview is readable by the manager it was assigned to, by
      -- whoever is actually conducting it, and by administrators.
      or is_admin()
      or interviewer_id = (select auth.uid())
      or exists (
        select 1 from public.applications a
        where a.id = interviews.application_id
          and a.final_interviewer_id = (select auth.uid())
      )
    )
  );

-- Updating an interview already required owning it; this also stops a manager
-- re-pointing an application at themselves to take another manager's applicant.
-- Only HR Staff assigns (at initial evaluation), and only while it is unassigned.
create or replace function public.protect_final_interviewer_assignment()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- No JWT means this isn't a user request: seeds, migrations, and service-role
  -- maintenance run with auth.uid() null and are not what this rule is for.
  -- Reaching here through the API always requires a session, since the
  -- applications policies demand is_active_staff() first.
  if (select auth.uid()) is null then
    return new;
  end if;

  if new.final_interviewer_id is distinct from old.final_interviewer_id then
    if old.final_interviewer_id is not null and not public.is_admin() then
      raise exception 'This applicant is already assigned to an HR Manager. Only an administrator can reassign them.';
    end if;
    if new.final_interviewer_id is not null and not exists (
      select 1 from public.profiles p
      where p.id = new.final_interviewer_id and p.role in ('hr_manager','admin') and p.status = 'active'
    ) then
      raise exception 'A final interview can only be assigned to an active HR Manager.';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_protect_final_interviewer_assignment on public.applications;
create trigger trg_protect_final_interviewer_assignment
  before update on public.applications
  for each row execute function public.protect_final_interviewer_assignment();
