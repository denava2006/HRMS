-- Three 8-hour shifts covering the full 24 hours, so an employee's recorded
-- times line up with a schedule that actually matches when they work. The
-- previous single "Standard Day Shift" meant anyone on an evening or night
-- roster was measured against 8:00–17:00 and looked permanently late.
--
-- Midnight Shift deliberately crosses midnight (22:00 -> 06:00). The attendance
-- calculations treat end_time <= start_time as an overnight schedule and roll
-- the end to the following day — see isOvernightSchedule() in
-- src/lib/attendanceCalculations.ts.
-- Each is a 9-hour span with a 60-minute unpaid break, giving 8 paid hours —
-- the same shape as the existing Standard Day Shift (08:00-17:00). The
-- one-hour overlap between shifts is the handover.
insert into public.work_schedules (id, name, working_days, start_time, end_time, break_minutes, is_default) values
  ('a1000000-0000-0000-0000-000000000001', 'Morning Shift',  '{1,2,3,4,5}', '06:00', '15:00', 60, false),
  ('a1000000-0000-0000-0000-000000000002', 'Evening Shift',  '{1,2,3,4,5}', '14:00', '23:00', 60, false),
  ('a1000000-0000-0000-0000-000000000003', 'Midnight Shift', '{1,2,3,4,5}', '22:00', '07:00', 60, false)
on conflict (id) do nothing;
