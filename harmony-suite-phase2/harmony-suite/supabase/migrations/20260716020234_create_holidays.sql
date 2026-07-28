create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  holiday_date date not null,
  holiday_type text not null check (holiday_type in ('regular', 'special', 'company')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_holidays_date on public.holidays (holiday_date);

create trigger trg_set_updated_at before update on public.holidays
  for each row execute function public.set_updated_at();

alter table public.holidays enable row level security;

create policy holidays_admin_manage on public.holidays
  for all using (public.is_admin()) with check (public.is_admin());

create policy holidays_staff_select on public.holidays
  for select using (public.is_active_staff());
