-- 'probationary' dropped per product decision. Postgres has no DROP VALUE for
-- enums, so this rebuilds the type without it, following the same pattern as
-- 20260716005100_rebuild_employment_status_enum.sql. Any existing probationary
-- employees become 'active' first, since the USING cast below would otherwise
-- fail on a value the new type doesn't have.
update public.employees set employment_status = 'active' where employment_status = 'probationary';

create type public.employment_status_new as enum (
  'active','regular','contractual','temporary','on_leave','resigned','terminated','retired'
);

alter table public.employees alter column employment_status drop default;
alter table public.employees
  alter column employment_status type public.employment_status_new
  using employment_status::text::public.employment_status_new;
alter table public.employees alter column employment_status set default 'active';

drop type public.employment_status;
alter type public.employment_status_new rename to employment_status;
