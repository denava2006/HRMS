-- The final interview is the HR Manager's call, not HR Staff's. HR Staff runs
-- the initial interview and, when passing the applicant, nominates which HR
-- Manager takes the final round — that hand-off is what this column records.
alter table public.applications
  add column final_interviewer_id uuid references public.profiles(id);

comment on column public.applications.final_interviewer_id is
  'HR Manager nominated by HR Staff at initial-evaluation time to conduct the final interview. Only this person may schedule/conduct/evaluate it.';

-- Replaces the previous rule ("final interview can only be scheduled by whoever
-- owns the initial interview"), which let the same HR Staff member run both
-- rounds end-to-end. Now a final interview may only be inserted by the manager
-- the application was handed off to, and that person must actually hold
-- approval authority — so re-pointing final_interviewer_id at a non-manager
-- can't be used to route around the rule.
drop policy interviews_insert_owner on public.interviews;

create policy interviews_insert_owner on public.interviews
  for insert
  with check (
    is_active_staff()
    and interviewer_id = (select auth.uid())
    and (
      interview_type = 'initial'::interview_type
      or (
        is_hr_manager_or_admin()
        and exists (
          select 1
          from public.applications a
          where a.id = interviews.application_id
            and a.final_interviewer_id = (select auth.uid())
        )
      )
    )
  );
