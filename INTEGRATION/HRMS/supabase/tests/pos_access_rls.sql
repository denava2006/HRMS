-- POS access — database contract test.
--
-- Phase 2A adds an Administrator-only screen for granting and revoking
-- pos_branch_assignments. It ships with no migration, which is only a
-- defensible decision if the guarantees it leans on are actually in the
-- database rather than merely in the UI. This file is that proof, and it is
-- re-runnable so a later slice cannot quietly remove one of them.
--
-- Run:
--   docker exec -i supabase_db_harmony-suite psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f - < supabase/tests/pos_access_rls.sql
--
-- Everything happens inside one transaction that is rolled back at the end.
-- Nothing is written. A failed expectation raises, which with ON_ERROR_STOP=1
-- exits non-zero.
--
-- Fixtures are derived from whatever accounts exist rather than hard-coded
-- ids, so this runs against demo data or real data. It needs one active
-- Administrator, one active HR Staff, one other active non-admin account, and
-- two active branches.

begin;

do $$
declare
  admin_id   uuid;
  staff_id   uuid;
  worker_id  uuid;
  branch_a   uuid;
  branch_b   uuid;
  grant_id   uuid;
  n          integer;
  b          boolean;
  actor      uuid;
  role_now   text;
begin
  ------------------------------------------------------------------ fixtures
  select id into admin_id from public.profiles where role = 'admin' and status = 'active' limit 1;
  select id into staff_id from public.profiles where role = 'hr_staff' and status = 'active' limit 1;
  -- order by, so the same account is chosen on every run: without it Postgres
  -- may return a different row each time and the test's assumptions about that
  -- account's existing assignments quietly stop holding.
  select id into worker_id from public.profiles
    where role not in ('admin') and status = 'active'
      and id <> coalesce(staff_id, '00000000-0000-0000-0000-000000000000'::uuid)
    order by created_at, id
    limit 1;
  select id into branch_a from public.branches where is_active order by name limit 1;
  select id into branch_b from public.branches where is_active and id <> branch_a order by name limit 1;

  if admin_id is null then raise exception 'fixture: no active admin profile'; end if;
  if staff_id is null then raise exception 'fixture: no active hr_staff profile'; end if;
  if worker_id is null then raise exception 'fixture: no other active non-admin profile'; end if;
  if branch_b is null then raise exception 'fixture: need two active branches'; end if;

  -- Start from a genuinely known state. Deactivating leaves the old rows
  -- behind, which then show up in the "sees only their own" count and collide
  -- with the partial unique index on re-grant. Deleting is safe: this whole
  -- transaction is rolled back.
  delete from public.pos_branch_assignments;

  -- Somebody else's assignment, so "sees only their own" is a real claim rather
  -- than a count of one in an otherwise empty table.
  insert into public.pos_branch_assignments (profile_id, branch_id, pos_role, created_by)
  values (staff_id, branch_b, 'manager', admin_id);

  ------------------------------------------------------- 1. admin may grant
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  set local role authenticated;

  insert into public.pos_branch_assignments (profile_id, branch_id, pos_role, created_by)
  values (worker_id, branch_a, 'cashier', admin_id)
  returning id into grant_id;
  raise notice 'PASS  1  administrator may grant POS access';

  reset role;

  ------------------------------------------------- 2. HR staff may not grant
  perform set_config('request.jwt.claims', json_build_object('sub', staff_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public.pos_branch_assignments (profile_id, branch_id, pos_role)
    values (worker_id, branch_b, 'manager');
    raise exception 'FAIL  2  HR Staff was allowed to grant POS access';
  exception when insufficient_privilege then
    raise notice 'PASS  2  HR Staff may not grant POS access';
  end;
  reset role;

  --------------------------------------- 3. the assignee may not grant/escalate
  perform set_config('request.jwt.claims', json_build_object('sub', worker_id, 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin
    insert into public.pos_branch_assignments (profile_id, branch_id, pos_role)
    values (worker_id, branch_b, 'manager');
    raise exception 'FAIL  3a a POS user granted themselves access at another branch';
  exception when insufficient_privilege then
    raise notice 'PASS  3a a POS user may not grant themselves access';
  end;

  -- Re-establish: the caught exception rolled back the subtransaction.
  perform set_config('request.jwt.claims', json_build_object('sub', worker_id, 'role', 'authenticated')::text, true);
  set local role authenticated;

  update public.pos_branch_assignments set pos_role = 'manager' where profile_id = worker_id;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL  3b a POS user escalated their own role (% rows)', n; end if;
  raise notice 'PASS  3b a POS user may not escalate their own role';

  --------------------------------------------------- 4. visibility is self-only
  select count(*) into n from public.pos_branch_assignments;
  if n <> 1 then raise exception 'FAIL  4a assignee sees % rows, expected only their own', n; end if;
  select count(*) into n from public.pos_branch_assignments a where a.profile_id <> worker_id;
  if n <> 0 then raise exception 'FAIL  4b assignee can see somebody else''s assignment'; end if;
  raise notice 'PASS  4  a POS user sees only their own assignment, not other people''s';

  ------------------------------------------------------- 5. branch/role scoping
  if not public.has_pos_access() then raise exception 'FAIL  5a assigned user has no POS access'; end if;
  if not public.has_pos_role(branch_a, array['cashier']::public.pos_role[]) then
    raise exception 'FAIL  5b cashier refused at their own branch';
  end if;
  if public.has_pos_role(branch_b, array['cashier']::public.pos_role[]) then
    raise exception 'FAIL  5c cashier admitted at a branch they are not assigned to';
  end if;
  if public.has_pos_role(branch_a, array['manager']::public.pos_role[]) then
    raise exception 'FAIL  5d cashier admitted as a manager';
  end if;
  select count(*) into n from public.my_pos_branches();
  if n <> 1 then raise exception 'FAIL  5e my_pos_branches returned % rows, expected 1', n; end if;
  raise notice 'PASS  5  branch and role scoping hold (own branch yes, other branch no, other role no)';

  reset role;

  ------------------------------------------- 6. an administrator is unscoped
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  set local role authenticated;

  if not public.has_pos_access() then raise exception 'FAIL  6a administrator has no POS access'; end if;
  if not public.has_pos_role(branch_b, array['cashier']::public.pos_role[]) then
    raise exception 'FAIL  6b administrator refused at a branch';
  end if;
  select count(*) into n from public.my_pos_branches();
  if n <> 0 then
    raise exception 'FAIL  6c administrator is branch-scoped (% rows); callers read empty as "all"', n;
  end if;
  raise notice 'PASS  6  administrator reaches every branch and is not branch-scoped';

  ------------------------------------------------- 7. revoke keeps the history
  update public.pos_branch_assignments set status = 'inactive' where id = grant_id;
  select count(*) into n from public.pos_branch_assignments where id = grant_id;
  if n <> 1 then raise exception 'FAIL  7  revoking deleted the assignment row'; end if;
  raise notice 'PASS  7  revoking sets status inactive and keeps the row';

  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', worker_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if public.has_pos_access() then raise exception 'FAIL  7b a revoked assignment still grants access'; end if;
  raise notice 'PASS  7b a revoked assignment grants nothing';
  reset role;

  ------------------------------------ 8. re-grant is a new row, not a revival
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  set local role authenticated;

  insert into public.pos_branch_assignments (profile_id, branch_id, pos_role, created_by)
  values (worker_id, branch_a, 'manager', admin_id);

  select count(*) into n from public.pos_branch_assignments where profile_id = worker_id and branch_id = branch_a;
  if n <> 2 then raise exception 'FAIL  8a expected 2 rows after re-grant, found %', n; end if;
  select count(*) into n from public.pos_branch_assignments
    where profile_id = worker_id and branch_id = branch_a and status = 'inactive';
  if n <> 1 then raise exception 'FAIL  8b the revoked row was overwritten instead of kept'; end if;
  raise notice 'PASS  8  re-granting adds a new row and preserves the revoked one';

  --------------------------------- 9. only one ACTIVE row per person + branch
  begin
    insert into public.pos_branch_assignments (profile_id, branch_id, pos_role, created_by)
    values (worker_id, branch_a, 'cashier', admin_id);
    raise exception 'FAIL  9  a second active assignment was allowed at the same branch';
  exception when unique_violation then
    raise notice 'PASS  9  a second active assignment at the same branch is refused';
  end;

  reset role;

  ------------------------------------------------------------------------------
  -- 10. THE ONE TO KEEP: deactivating the account closes the till.
  --
  --   inactive profile + active pos_branch_assignment
  --     -> has_pos_access()  = false
  --     -> my_pos_branches() = no rows
  --
  -- has_pos_role() joins profiles and requires status = 'active', so
  -- deactivating an account revokes its POS access without anyone having to
  -- remember to revoke the assignment separately. The assignment row is
  -- deliberately left active here -- that is the whole point of the check.
  ------------------------------------------------------------------------------
  update public.profiles set status = 'inactive' where id = worker_id;

  perform set_config('request.jwt.claims', json_build_object('sub', worker_id, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.pos_branch_assignments
    where profile_id = worker_id and status = 'active';
  if n < 1 then raise exception 'FAIL 10  precondition: expected a live assignment to test against'; end if;

  b := public.has_pos_access();
  if b then
    raise exception 'FAIL 10a inactive profile with an active assignment still has POS access';
  end if;

  select count(*) into n from public.my_pos_branches();
  if n <> 0 then
    raise exception 'FAIL 10b inactive profile still lists % POS branch(es)', n;
  end if;
  raise notice 'PASS 10  inactive profile + active assignment -> no access, no branches';

  reset role;

  ------------------------------------------- 11. the helpers are not public
  set local role anon;
  begin
    perform public.has_pos_access();
    raise exception 'FAIL 11  anon may execute has_pos_access()';
  exception when insufficient_privilege then
    raise notice 'PASS 11  anon may not execute the POS helper functions';
  end;
  reset role;

  ------------------------------------------------------- 12. the actor stamp
  --
  -- created_by must be what the database saw, not what the caller sent
  -- (20260825010000_pos_assignment_actor_is_the_caller.sql).
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- Deliberately lie about the grantor.
  insert into public.pos_branch_assignments (profile_id, branch_id, pos_role, created_by)
  values (worker_id, branch_b, 'cashier', staff_id)
  returning created_by into actor;
  if actor <> admin_id then
    raise exception 'FAIL 12a a client-supplied created_by (%) was stored instead of auth.uid() (%)', actor, admin_id;
  end if;
  raise notice 'PASS 12a a client-supplied created_by is overwritten with the caller';

  -- Omit it entirely.
  update public.pos_branch_assignments set status = 'inactive'
    where profile_id = worker_id and branch_id = branch_b and status = 'active';
  insert into public.pos_branch_assignments (profile_id, branch_id, pos_role)
  values (worker_id, branch_b, 'cashier')
  returning created_by into actor;
  if actor <> admin_id then
    raise exception 'FAIL 12b an omitted created_by was stored as %, expected the caller', actor;
  end if;
  raise notice 'PASS 12b an omitted created_by is filled in with the caller';

  -- And it cannot be rewritten afterwards.
  update public.pos_branch_assignments set created_by = staff_id
    where profile_id = worker_id and branch_id = branch_b and status = 'active';
  select a.created_by into actor from public.pos_branch_assignments a
    where a.profile_id = worker_id and a.branch_id = branch_b and a.status = 'active';
  if actor <> admin_id then
    raise exception 'FAIL 12c created_by was rewritten by an update to %', actor;
  end if;
  raise notice 'PASS 12c created_by cannot be rewritten by a later update';

  reset role;

  -- A non-administrator is still refused outright: the stamp hardens the audit
  -- trail, it does not widen who may write.
  perform set_config('request.jwt.claims', json_build_object('sub', staff_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public.pos_branch_assignments (profile_id, branch_id, pos_role)
    values (worker_id, branch_a, 'cashier');
    raise exception 'FAIL 12d the actor trigger let a non-administrator insert';
  exception when insufficient_privilege then
    raise notice 'PASS 12d a non-administrator is still refused';
  end;
  reset role;

  ------------------------------------------------ 13. audit trail is writable
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.audit_logs (actor_id, action, table_name, record_id)
  values (admin_id, 'POS Access Granted', 'pos_branch_assignments', grant_id);
  raise notice 'PASS 13  an administrator may record the change in audit_logs';
  reset role;

  select current_user into role_now;
  raise notice '--- all POS access contract checks passed (running as %) ---', role_now;
end $$;

rollback;

-- Guard against a future edit that drops the rollback: if this prints anything
-- other than the count the file started with, the test wrote to the database.
select 'assignments after rollback: ' || count(*)::text as verify
from public.pos_branch_assignments;
