-- The catalogue RPCs were left executable by anon.
--
-- 20260825020000 ended with `revoke all on function ... from anon` followed by
-- grants to authenticated and service_role, which reads as though it closed the
-- door. The catalogue disagreed:
--
--   proacl = {=X/postgres, postgres=X/postgres,
--             authenticated=X/postgres, service_role=X/postgres}
--
-- The leading `=X/postgres` is a grant to PUBLIC, which PostgreSQL applies to
-- every new function by default. anon was never granted EXECUTE explicitly, so
-- revoking it from anon removed nothing -- anon simply inherits PUBLIC.
--
-- This is the mirror image of 20260813010000, where the POS helpers had the
-- opposite problem: PUBLIC had been revoked but an explicit anon grant (from
-- ALTER DEFAULT PRIVILEGES in 20260716070000) survived it. Between the two,
-- the lesson is that neither revoke alone is sufficient in this database, so
-- both are issued here.
--
-- Nothing leaks today. All four are SECURITY DEFINER but scoped by
-- has_pos_access() / has_pos_role() / is_admin(), each of which resolves
-- auth.uid() -- a signed-out caller gets an empty set from the readers and a
-- refusal from the writers. This is closed because a function whose stated
-- privileges disagree with its real ones is a trap for whoever extends it next,
-- and every later POS slice will reach for these.
--
-- Verified with has_function_privilege(), not assumed.
--
-- Forward-only: 20260825020000 is left exactly as it was applied.

revoke all on function public.get_pos_categories() from public;
revoke all on function public.get_pos_catalogue(uuid) from public;
revoke all on function public.delete_pos_category(uuid, uuid) from public;
revoke all on function public.reorder_pos_category(uuid, integer) from public;

revoke all on function public.get_pos_categories() from anon;
revoke all on function public.get_pos_catalogue(uuid) from anon;
revoke all on function public.delete_pos_category(uuid, uuid) from anon;
revoke all on function public.reorder_pos_category(uuid, integer) from anon;

-- Trigger functions are not usefully callable by hand (they return trigger and
-- need a trigger context), but a stray PUBLIC grant on them is noise in the
-- same catalogue, so they are closed too.
revoke all on function public.prepare_pos_catalogue_row() from public, anon;
revoke all on function public.protect_general_pos_category() from public, anon;
revoke all on function public.enforce_branch_product_boundaries() from public, anon;

-- Re-assert the intended grants: REVOKE ... FROM PUBLIC does not touch an
-- explicit grant to a named role, but stating them keeps this migration
-- readable on its own.
grant execute on function public.get_pos_categories() to authenticated, service_role;
grant execute on function public.get_pos_catalogue(uuid) to authenticated, service_role;
grant execute on function public.delete_pos_category(uuid, uuid) to authenticated, service_role;
grant execute on function public.reorder_pos_category(uuid, integer) to authenticated, service_role;
