alter table public.payroll_periods
  add column frequency text not null default 'monthly'
  check (frequency in ('weekly', 'biweekly', 'semi_monthly', 'monthly'));
