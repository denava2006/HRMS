-- The shift an employee actually works was chosen on the job offer and then
-- dropped: Complete Deployment never captured it, and employee creation never
-- asked, so every employee made through the UI ended up with a NULL
-- work_schedule_id and silently fell back to whichever schedule is default.
-- With three shifts covering 24 hours that is wrong for two thirds of staff —
-- attendance would measure a night worker against the day shift.
--
-- Recording it on the deployment closes the chain:
--   Job Offer (proposes shift) -> Deployment (confirms it) -> Employee record
alter table public.deployment_records
  add column work_schedule_id uuid references public.work_schedules(id);

comment on column public.deployment_records.work_schedule_id is
  'Shift the employee reports on, carried from the accepted job offer and inherited by the employee record.';
