-- Addresses become Province -> City/Municipality -> Barangay, plus a manual
-- street line.
--
-- One free-text "Complete Address" box meant every applicant wrote their
-- address differently — "Q.C.", "Quezon City", "Quezon city, NCR" — so the
-- addresses could never be grouped, filtered, or matched against a branch.
-- Splitting the administrative part out makes it data; the house and street
-- number stay free text, because that part genuinely is.
--
-- One self-referencing table rather than three, because the levels behave
-- identically (a name under a parent) and one table means one place to
-- maintain, one policy, and one cascade query.
--
-- DATA SCOPE: seeded with all 81 provinces plus Metro Manila (a region rather
-- than a province, but the level an address actually needs), and with NCR and
-- Cavite filled in down to barangay level — the areas this system's own records
-- live in. The full PSGC set is ~42,000 barangays and belongs in an import, not
-- a migration. The table is administrator-managed, so the rest is extendable
-- without touching code.

create table if not exists public.ph_locations (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.ph_locations(id) on delete cascade,
  level text not null check (level in ('province', 'city', 'barangay')),
  name text not null,
  created_at timestamptz not null default now()
);

-- A province has no parent; a city or barangay must have one. Enforced here so
-- the tree can't grow a floating branch.
alter table public.ph_locations
  drop constraint if exists ph_locations_parent_matches_level,
  add constraint ph_locations_parent_matches_level check (
    (level = 'province' and parent_id is null)
    or (level <> 'province' and parent_id is not null)
  );

-- Names repeat across the country (there is a San Isidro in most provinces),
-- so uniqueness is per parent, not global.
create unique index if not exists ph_locations_unique_child
  on public.ph_locations (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

create index if not exists idx_ph_locations_parent on public.ph_locations (parent_id);

alter table public.ph_locations enable row level security;

-- Applicants fill in an address before they have an account, so the list has to
-- be readable by anon. It's public geography — there is nothing to protect.
create policy ph_locations_public_read on public.ph_locations
  for select using (true);

-- Only administrators extend it. It's reference data about the country, not
-- about the company, so it isn't part of the HR approval workflow.
create policy ph_locations_admin_manage on public.ph_locations
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.ph_locations to anon, authenticated;

-- ---------- Address columns ----------
-- Names are stored, not ids: an address is a historical fact about where
-- someone lived when they wrote it down, and it should not change because an
-- administrator later corrected a spelling in the list.
alter table public.applicants
  add column if not exists province text,
  add column if not exists city text,
  add column if not exists barangay text;

alter table public.employees
  add column if not exists province text,
  add column if not exists city text,
  add column if not exists barangay text;

comment on column public.applicants.address is
  'House/unit number and street only. The administrative parts live in province/city/barangay.';
comment on column public.employees.address is
  'House/unit number and street only. The administrative parts live in province/city/barangay.';
