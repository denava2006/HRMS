create table public.employee_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  event text not null check (event = any (array[
    'record_created',
    'employee_id_generated',
    'account_created',
    'invitation_sent',
    'invitation_resent',
    'account_activated',
    'account_disabled',
    'documents_uploaded',
    'department_assigned',
    'position_assigned',
    'status_updated',
    'information_updated'
  ])),
  notes text,
  actor_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index idx_employee_history_employee on public.employee_history(employee_id);

alter table public.employee_history enable row level security;

create policy employee_history_staff_all on public.employee_history
  for all
  using (public.is_active_staff())
  with check (public.is_active_staff());
