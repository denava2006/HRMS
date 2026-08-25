-- 20260813000000 revoked the three POS helper functions from `public` and then
-- granted EXECUTE to authenticated and service_role. That left them callable by
-- `anon` anyway.
--
-- The reason is 20260716070000_grant_table_privileges_to_api_roles.sql, which
-- set ALTER DEFAULT PRIVILEGES ... ON ROUTINES TO anon, authenticated,
-- service_role. Every function created in `public` since then is born with an
-- explicit grant to anon, and REVOKE ... FROM PUBLIC does not remove an
-- explicit grant to a named role. So the previous migration read as though it
-- closed the door while the catalog said otherwise -- verified with
-- has_function_privilege('anon', ...), not assumed.
--
-- Nothing leaks today: all three are SECURITY DEFINER but scoped entirely by
-- auth.uid(), so a signed-out caller gets false and an empty set. This is
-- closed because a helper whose stated privileges disagree with its real ones
-- is a trap for whoever extends it next -- and every later POS slice
-- (products, till, transactions) is going to reach for has_pos_role() as its
-- RLS predicate.
--
-- Forward-only: the previous migration is left exactly as it was applied
-- rather than edited after the fact.
revoke execute on function public.has_pos_role(uuid, public.pos_role[]) from anon;
revoke execute on function public.has_pos_access() from anon;
revoke execute on function public.my_pos_branches() from anon;
