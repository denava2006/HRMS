-- Working hours/days on a job offer were free text, retyped per offer and
-- prone to drifting from the schedules Admin actually configures. They now
-- come from a real work_schedules row instead.
--
-- working_hours / working_days are kept and still populated, with the text
-- derived from the chosen schedule at the moment the offer is prepared: an
-- offer (and the contract printed from it) should preserve the terms as they
-- were offered, not silently change if Admin later edits that schedule.
alter table public.job_offers
  add column work_schedule_id uuid references public.work_schedules(id);

comment on column public.job_offers.work_schedule_id is
  'Work schedule the offer was based on. working_hours/working_days hold the human-readable text captured from it at offer time.';
