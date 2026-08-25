-- Postgres can't drop enum values directly, so rebuild the type. Confirmed no
-- existing rows use 'contract' or 'internship' before running this.
create type public.employment_type_new as enum ('full_time', 'part_time');

alter table public.job_postings alter column employment_type drop default;
alter table public.job_postings
  alter column employment_type type public.employment_type_new
  using employment_type::text::public.employment_type_new;
alter table public.job_postings alter column employment_type set default 'full_time'::public.employment_type_new;

alter table public.job_offers alter column employment_type drop default;
alter table public.job_offers
  alter column employment_type type public.employment_type_new
  using employment_type::text::public.employment_type_new;
alter table public.job_offers alter column employment_type set default 'full_time'::public.employment_type_new;

alter table public.employees alter column employment_type drop default;
alter table public.employees
  alter column employment_type type public.employment_type_new
  using employment_type::text::public.employment_type_new;
alter table public.employees alter column employment_type set default 'full_time'::public.employment_type_new;

drop type public.employment_type;
alter type public.employment_type_new rename to employment_type;
