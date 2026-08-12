alter table public.employees
  add column middle_name text,
  add column civil_status text,
  add column nationality text,
  add column currency text not null default 'PHP',
  add column probation_period text,
  add column benefits text;
