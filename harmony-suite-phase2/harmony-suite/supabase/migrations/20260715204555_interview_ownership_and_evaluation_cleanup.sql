-- Part 3: Overall Recommendation is being removed from the UI entirely — the
-- hiring decision now comes only from which action button was clicked.
alter table public.interviews drop column overall_recommendation;

-- Part 2/10: interviewer is no longer manually picked — the HR staff member who
-- schedules an interview automatically becomes its assigned interviewer, and
-- only that person may progress it. Split the old all-active-staff policy into
-- SELECT (everyone can still view, per "read-only access" for non-owners),
-- INSERT (self-assign only; a final interview can only be created by whoever
-- owns the corresponding initial interview), and UPDATE (owner only).
drop policy interviews_staff_all on public.interviews;

create policy interviews_select_staff on public.interviews
  for select using (is_active_staff());

create policy interviews_insert_owner on public.interviews
  for insert
  with check (
    is_active_staff()
    and interviewer_id = auth.uid()
    and (
      interview_type = 'initial'::interview_type
      or exists (
        select 1 from public.interviews existing
        where existing.application_id = application_id
          and existing.interview_type = 'initial'::interview_type
          and existing.interviewer_id = auth.uid()
      )
    )
  );

create policy interviews_update_owner on public.interviews
  for update
  using (is_active_staff() and interviewer_id = auth.uid())
  with check (is_active_staff() and interviewer_id = auth.uid());

-- Part 10: even though applications_staff_all still lets any active staff update
-- applications (Recruitment screening legitimately needs that), a hire or an
-- interview-stage rejection specifically must only be performed by whichever
-- interviewer actually owns the interview that produced that outcome. This is
-- the backend backstop — it fires regardless of what the client sends, for both
-- direct table writes and any future RPC that goes through the interviews flow.
create or replace function public.protect_interview_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_final_interviewer uuid;
  v_owning_interviewer uuid;
begin
  if NEW.status = 'hired' and OLD.status <> 'hired' then
    select interviewer_id into v_final_interviewer
    from public.interviews
    where application_id = NEW.id and interview_type = 'final'::interview_type and status = 'passed'::interview_status;

    if v_final_interviewer is null or v_final_interviewer <> auth.uid() then
      raise exception 'Only the assigned interviewer can hire this applicant.';
    end if;
  end if;

  if NEW.status = 'rejected' and OLD.status = 'interview_scheduled' then
    select interviewer_id into v_owning_interviewer
    from public.interviews
    where application_id = NEW.id and status = 'failed'::interview_status
    order by updated_at desc
    limit 1;

    if v_owning_interviewer is null or v_owning_interviewer <> auth.uid() then
      raise exception 'Only the assigned interviewer can reject this applicant.';
    end if;
  end if;

  return NEW;
end;
$$;

revoke execute on function public.protect_interview_ownership() from public, anon, authenticated;

create trigger trg_protect_interview_ownership
  before update on public.applications
  for each row execute function public.protect_interview_ownership();

-- Part 5/6: clean up the free-text currency value from earlier testing and drop
-- the timezone setting — the system now uses the browser's local time and a
-- proper two-option currency setting instead.
update public.system_settings set value = '"PHP"'::jsonb where key = 'currency';
delete from public.system_settings where key = 'timezone';

