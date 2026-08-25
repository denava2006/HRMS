-- SECURITY HOTFIX: TRUNCATE bypasses Row Level Security.
--
-- Found during the Phase 7C review, confirmed empirically: an ordinary
-- authenticated employee could run
--
--     truncate public.audit_logs;
--
-- and destroy the entire enterprise audit trail. The same held for
-- public.pos_branch_assignments -- one statement removes every POS access
-- grant in the business.
--
-- Why RLS did not stop it: RLS filters rows for SELECT/INSERT/UPDATE/DELETE.
-- TRUNCATE is not a row operation. PostgreSQL checks the TRUNCATE table
-- privilege and nothing else -- no policy is ever consulted. So a table can
-- look perfectly locked down in pg_policies and still be wipeable by anyone
-- holding the grant.
--
-- Where the grant came from: 20260716070000 mirrors the remote project's
-- privilege model with
--
--     grant all privileges on all tables in schema public to anon, authenticated, service_role;
--     alter default privileges in schema public grant all privileges on tables to ...;
--
-- "all privileges" includes TRUNCATE. That was deliberate and correct in
-- intent -- PostgREST needs table-level grants before RLS is evaluated at all
-- -- but SELECT/INSERT/UPDATE/DELETE are the ones RLS then governs. TRUNCATE
-- is the one that is not governed by anything, and it was never needed: the
-- application does not issue TRUNCATE anywhere, in any migration or any
-- client path.
--
-- This is the sixth instance of the default-privileges trap in this project.
-- Only four tables escaped it -- pos_sales, pos_sale_items,
-- pos_branch_inventory and pos_inventory_movements -- because their own
-- migrations happened to issue explicit table revokes after an earlier
-- incident. Everything else, 36 tables, was exposed.
--
-- SCOPE, deliberately narrow:
--
--   * TRUNCATE only. UPDATE and DELETE are NOT touched. Existing HRMS modules
--     legitimately rely on RLS-governed UPDATE/DELETE grants, and RLS *does*
--     govern those. Removing them wholesale would break working features to
--     fix a problem they do not have. A per-table DML audit is separate work.
--
--   * anon and authenticated only. service_role is the trusted server-side
--     role used by edge functions; it is never held by a browser. Narrowing it
--     is defensible but is not this emergency, and blanket-revoking a role a
--     future FMS bridge may need would be a trap for the next agent.

-- ---------------------------------------------------------- existing tables
revoke truncate on all tables in schema public from anon, authenticated;

-- ------------------------------------------------------------ future tables
--
-- Revoking from the existing tables alone would fix today and re-break on the
-- next `create table`. Default privileges are recorded per creating role;
-- every table in public is owned by postgres and every migration runs as
-- postgres, so this is the entry that governs what we create. (A second
-- default-ACL entry exists for supabase_admin, which postgres is not a member
-- of and cannot alter -- it does not apply to tables created by our
-- migrations.)
alter default privileges in schema public
  revoke truncate on tables from anon, authenticated;

-- ------------------------------------------------------------- verification
--
-- Assert the catalog, not the statements above. This project has been caught
-- five times by assuming a REVOKE did what it read like, and the whole point
-- of this migration is that the privilege system disagreed with the policies.
do $$
declare
  _leftover text;
  _defacl   text;
begin
  select string_agg(table_name, ', ' order by table_name) into _leftover
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee in ('anon', 'authenticated')
    and privilege_type = 'TRUNCATE';

  if _leftover is not null then
    raise exception 'TRUNCATE still granted on: %', _leftover;
  end if;

  -- 'D' is TRUNCATE in an aclitem string (arwdDxtm).
  select d.defaclacl::text into _defacl
  from pg_default_acl d
  join pg_namespace n on n.oid = d.defaclnamespace
  where n.nspname = 'public'
    and d.defaclobjtype = 'r'
    and pg_get_userbyid(d.defaclrole) = 'postgres';

  if _defacl ~ 'anon=[a-zA-Z]*D' or _defacl ~ 'authenticated=[a-zA-Z]*D' then
    raise exception 'default privileges still grant TRUNCATE to an API role: %', _defacl;
  end if;

  raise notice 'TRUNCATE revoked from anon and authenticated, now and for future tables';
end $$;
