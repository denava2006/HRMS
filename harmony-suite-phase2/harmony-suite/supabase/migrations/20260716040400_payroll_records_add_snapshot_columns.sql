alter table public.payroll_records
  add column currency text not null default 'PHP',
  add column overtime_pay numeric not null default 0,
  add column holiday_pay numeric not null default 0,
  add column notes text,
  add column working_days numeric not null default 0,
  add column days_present numeric not null default 0,
  add column absent_days numeric not null default 0,
  add column late_minutes integer not null default 0,
  add column undertime_minutes integer not null default 0,
  add column overtime_hours numeric not null default 0,
  add column paid_leave_days numeric not null default 0,
  add column unpaid_leave_days numeric not null default 0;
