-- Probation Period was collected on both the job offer and the employee
-- record but never actually used anywhere else in the system (no reminder,
-- no status transition tied to it) -- dropped per product decision to keep
-- the offer/employee forms focused on what the demo actually needs.
alter table public.job_offers drop column if exists probation_period;
alter table public.employees drop column if exists probation_period;
