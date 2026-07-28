-- The remote project predates Supabase's stricter "new entities are not
-- auto-exposed" default (config.toml's auto_expose_new_tables note) -- on
-- remote, anon/authenticated/service_role all hold blanket table-level
-- GRANTs (SELECT/INSERT/UPDATE/DELETE/etc) on every public table, with Row
-- Level Security doing 100% of the actual access control on top. A fresh
-- local Postgres instance does not carry that legacy grant set, so without
-- this, PostgREST rejects requests with "permission denied" before RLS is
-- ever evaluated, even for policies that would have allowed the row.
--
-- This intentionally mirrors the remote project's real privilege model
-- exactly (verified via information_schema.role_table_grants) rather than
-- hand-picking a "safer-looking" subset that would silently diverge from
-- what's actually deployed.
grant usage on schema public to anon, authenticated, service_role;

grant all privileges on all tables in schema public to anon, authenticated, service_role;
grant all privileges on all sequences in schema public to anon, authenticated, service_role;
grant all privileges on all routines in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all privileges on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all privileges on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all privileges on routines to anon, authenticated, service_role;
