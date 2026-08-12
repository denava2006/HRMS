-- Currency was selectable in three places at once: system-wide in Settings,
-- per job offer, and per employee. Nothing ever converted between them, so the
-- only thing three settings could produce was disagreement about what a number
-- on a payslip meant.
--
-- The system runs in pesos. The `currency` columns on employees, job_offers,
-- and payroll_records stay — they label historical rows and cost nothing — but
-- there is no longer anything to choose, so the setting goes.
delete from public.system_settings where key = 'currency';
