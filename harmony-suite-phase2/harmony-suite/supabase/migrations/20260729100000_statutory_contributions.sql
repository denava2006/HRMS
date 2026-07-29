-- Philippine mandatory employee contributions, stored per payroll record so a
-- released payslip keeps the amounts as computed at the time — contribution
-- tables change yearly, and a reprinted payslip must not silently change with
-- them.
--
-- These are the EMPLOYEE share only. The employer share is a company cost and
-- is not deducted from the employee, so it isn't tracked here.
alter table public.payroll_records
  add column sss_contribution numeric(12,2) not null default 0,
  add column philhealth_contribution numeric(12,2) not null default 0,
  add column pagibig_contribution numeric(12,2) not null default 0;

comment on column public.payroll_records.sss_contribution is
  'Employee share of SSS, computed from the monthly salary credit.';
comment on column public.payroll_records.philhealth_contribution is
  'Employee share of PhilHealth (half the premium).';
comment on column public.payroll_records.pagibig_contribution is
  'Employee share of Pag-IBIG (HDMF).';
