-- The Holiday module goes away entirely.
--
-- Removing it means removing what depended on it, not just hiding the page:
-- the holidays table, the holiday-pay line in payroll generation, and the
-- 'holiday' attendance status that was only ever set by checking that table.
-- Leaving any of those behind would give the system a concept it can no longer
-- populate — an attendance status nobody can reach, a pay component always
-- computed as zero.
--
-- payroll_line_items rows already labelled 'Holiday Pay' are left alone. They
-- are free text on historical payslips, and a payslip should still say what it
-- said when it was released.

drop table if exists public.holidays cascade;

alter table public.payroll_records drop column if exists holiday_pay;

-- ---------- attendance_status loses 'holiday' ----------
-- No rows use it (it was only ever set from the holidays table), so no mapping
-- is needed — but Postgres has no DROP VALUE, so the type is still rebuilt.
create type public.attendance_status_new as enum (
  'present', 'absent', 'late', 'on_leave', 'half_day', 'rest_day', 'official_business', 'work_from_home'
);

alter table public.attendance_records alter column status drop default;
alter table public.attendance_records
  alter column status type public.attendance_status_new
  using status::text::public.attendance_status_new;

drop type public.attendance_status;
alter type public.attendance_status_new rename to attendance_status;
alter table public.attendance_records alter column status set default 'present'::public.attendance_status;
