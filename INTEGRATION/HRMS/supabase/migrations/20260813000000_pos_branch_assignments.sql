-- POS access foundation.
--
-- The POS is a second portal inside this system, not a second system. Identity
-- stays here: one account, one login, one profiles row. What the POS adds is a
-- scope this application did not previously need -- *which branch* someone
-- works a till at.
--
-- That is why POS access is a separate table rather than another value in
-- public.user_role. `profiles.role` is global: it can say "this person is HR
-- Staff", but it cannot say "this person is a cashier at Cavite Branch and
-- nowhere else". A global 'cashier' role would also collide with the fact that
-- a cashier is normally an employee too, and one column cannot hold both.
--
-- Administrators are deliberately absent from pos_role. An Administrator's POS
-- access comes from profiles.role = 'admin' and covers every branch; recording
-- it here as well would create two places that answer the same question and
-- one of them would eventually be wrong.

create type public.pos_role as enum ('manager', 'cashier');

create table public.pos_branch_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  -- restrict, not cascade: a branch with POS staff assigned should refuse to be
  -- deleted and say so, the same way departments/positions already do
  -- (20260731080000_reference_data_in_use_cannot_be_deleted.sql), rather than
  -- silently revoking everyone's till access.
  branch_id uuid not null references public.branches(id) on delete restrict,
  pos_role public.pos_role not null,
  -- Same vocabulary as profiles.status. Revoking access sets this to
  -- 'inactive' instead of deleting the row, so the audit trail survives.
  status public.account_status not null default 'active',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One *active* assignment per person per branch. Partial rather than a whole
-- table constraint on purpose: revoked assignments stay as history, and the
-- same person can later be re-granted access to the same branch.
create unique index pos_branch_assignments_active_unique
  on public.pos_branch_assignments (profile_id, branch_id)
  where status = 'active';

create index pos_branch_assignments_profile_idx on public.pos_branch_assignments (profile_id);
create index pos_branch_assignments_branch_idx on public.pos_branch_assignments (branch_id);

create trigger trg_set_updated_at
  before update on public.pos_branch_assignments
  for each row execute function public.set_updated_at();

-- An assignment is only worth anything while the account behind it is still
-- active. Checking profiles.status here as well as pos_branch_assignments.status
-- means deactivating an HR account also closes its till access, without anyone
-- having to remember to revoke it separately.
--
-- _branch_id null means "any branch", which is what the portal-level question
-- ("may this person open the POS at all?") needs.
create or replace function public.has_pos_role(_branch_id uuid, _roles public.pos_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1
    from public.pos_branch_assignments a
    join public.profiles p on p.id = a.profile_id
    where a.profile_id = auth.uid()
      and a.status = 'active'
      and p.status = 'active'
      and a.pos_role = any(_roles)
      and (_branch_id is null or a.branch_id = _branch_id)
  );
$$;

-- The portal decision: does this account reach the POS at all, by any role, at
-- any branch? Administrators always do.
create or replace function public.has_pos_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_pos_role(null, array['manager', 'cashier']::public.pos_role[]);
$$;

-- The branches a non-admin may act in. Administrators are branch-unscoped, so
-- callers must treat an empty result from an admin as "all branches" rather
-- than "none" -- see has_pos_role, which is the authorization check.
create or replace function public.my_pos_branches()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select a.branch_id
  from public.pos_branch_assignments a
  join public.profiles p on p.id = a.profile_id
  where a.profile_id = auth.uid()
    and a.status = 'active'
    and p.status = 'active';
$$;

alter table public.pos_branch_assignments enable row level security;

-- Everyone may read their own assignments -- the app needs this on every page
-- load to decide which portals to offer, exactly as profiles has a self-select
-- policy for the same reason (20260716063417).
create policy pos_branch_assignments_self_select on public.pos_branch_assignments
  for select using (profile_id = auth.uid());

-- Granting and revoking POS access is account administration, which is already
-- Administrator-only in this system (HR Accounts). Managing assignments from
-- the UI is a later slice; the policy is written now so the table is never
-- open in the meantime.
create policy pos_branch_assignments_admin_manage on public.pos_branch_assignments
  for all using (public.is_admin()) with check (public.is_admin());

-- Matches this project's existing privilege model: blanket table grants with
-- RLS doing all of the real access control on top
-- (20260716070000_grant_table_privileges_to_api_roles.sql explains why).
grant all privileges on table public.pos_branch_assignments to anon, authenticated, service_role;

revoke all on function public.has_pos_role(uuid, public.pos_role[]) from public;
revoke all on function public.has_pos_access() from public;
revoke all on function public.my_pos_branches() from public;
grant execute on function public.has_pos_role(uuid, public.pos_role[]) to authenticated, service_role;
grant execute on function public.has_pos_access() to authenticated, service_role;
grant execute on function public.my_pos_branches() to authenticated, service_role;
