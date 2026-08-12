create type public.employment_status_new as enum (
  'active','probationary','regular','contractual','temporary','on_leave','resigned','terminated','retired'
);

alter table public.employees alter column employment_status drop default;
alter table public.employees
  alter column employment_status type public.employment_status_new
  using employment_status::text::public.employment_status_new;
alter table public.employees alter column employment_status set default 'active';

drop type public.employment_status;
alter type public.employment_status_new rename to employment_status;
