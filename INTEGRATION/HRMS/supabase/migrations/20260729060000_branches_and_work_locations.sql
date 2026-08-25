-- Assigned Branch and Work Location on a deployment were free text, so every
-- deployment invented its own spelling. They're reference data now, managed
-- the same way departments/positions are, and picked from a dropdown.
create table public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.work_locations (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references public.branches(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, name)
);

alter table public.branches enable row level security;
alter table public.work_locations enable row level security;

-- Same shape as the other admin-managed reference tables: all staff read,
-- only admin writes. (The HR Staff / HR Manager split for reference data is
-- handled separately by the approval workflow migration.)
create policy branches_staff_select on public.branches
  for select using (is_active_staff());
create policy branches_admin_manage on public.branches
  for all using (is_admin()) with check (is_admin());

create policy work_locations_staff_select on public.work_locations
  for select using (is_active_staff());
create policy work_locations_admin_manage on public.work_locations
  for all using (is_admin()) with check (is_admin());

grant all privileges on table public.branches to anon, authenticated, service_role;
grant all privileges on table public.work_locations to anon, authenticated, service_role;

-- deployment_records keeps its existing text columns (historical rows depend
-- on them) but now also records which branch/location was actually chosen.
alter table public.deployment_records
  add column branch_id uuid references public.branches(id),
  add column work_location_id uuid references public.work_locations(id);

create index idx_work_locations_branch on public.work_locations(branch_id);

-- Starter reference data so the dropdowns aren't empty on a fresh install.
insert into public.branches (id, name, address) values
  ('b1000000-0000-0000-0000-000000000001', 'Main Office', '123 Ayala Avenue, Makati City'),
  ('b1000000-0000-0000-0000-000000000002', 'Cavite Branch', 'Aguinaldo Highway, Dasmariñas, Cavite')
on conflict (id) do nothing;

insert into public.work_locations (branch_id, name, description) values
  ('b1000000-0000-0000-0000-000000000001', 'Head Office - 5th Floor', 'Corporate and administrative functions'),
  ('b1000000-0000-0000-0000-000000000001', 'Sales Floor', 'Customer-facing sales area'),
  ('b1000000-0000-0000-0000-000000000002', 'Cavite Store', 'Retail floor and stockroom'),
  ('b1000000-0000-0000-0000-000000000002', 'Cavite Warehouse', 'Inventory and logistics')
on conflict do nothing;
