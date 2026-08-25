create table public.work_schedules (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  working_days smallint[] not null default '{1,2,3,4,5}',
  start_time time not null,
  end_time time not null,
  break_minutes integer not null default 60,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index work_schedules_one_default on public.work_schedules (is_default) where is_default;

create trigger trg_set_updated_at before update on public.work_schedules
  for each row execute function public.set_updated_at();

alter table public.work_schedules enable row level security;

create policy work_schedules_admin_manage on public.work_schedules
  for all using (public.is_admin()) with check (public.is_admin());

create policy work_schedules_staff_select on public.work_schedules
  for select using (public.is_active_staff());

insert into public.work_schedules (name, working_days, start_time, end_time, break_minutes, is_default)
values ('Standard Day Shift', '{1,2,3,4,5}', '08:00', '17:00', 60, true);

alter table public.employees add column work_schedule_id uuid references public.work_schedules(id);
