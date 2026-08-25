-- pos_sale_receipt was callable by any signed-in account.
--
-- 20260825090000 deliberately did not grant it to `authenticated`, and revoked
-- it from `public` and `anon`. The catalogue disagreed:
--
--   has_function_privilege('authenticated', 'public.pos_sale_receipt(uuid)', 'execute') = true
--
-- because 20260716070000_grant_table_privileges_to_api_roles.sql set
-- ALTER DEFAULT PRIVILEGES ... ON ROUTINES TO anon, authenticated, service_role.
-- Every function created in `public` since then is born with an explicit grant
-- to authenticated, and revoking from `public` and `anon` does not touch it.
--
-- That mattered. pos_sale_receipt takes a sale id and returns that sale's
-- receipt unconditionally -- it is SECURITY DEFINER with no authorization of
-- its own, because the only intended caller is checkout_pos_sale, which has
-- already established that this cashier just made this sale. Left reachable, it
-- would hand any signed-in account another branch's receipt for any sale id it
-- came by: customer-facing fields only, no cost, but sales data from a branch
-- the caller has no access to.
--
-- Nothing else changes. checkout_pos_sale keeps its own grant and calls this as
-- the owner, so the till is unaffected.
--
-- This is the fourth shape of the same trap in this project:
--
--   20260813010000  explicit anon EXECUTE survived REVOKE ... FROM PUBLIC
--   20260825030000  PUBLIC's default EXECUTE survived REVOKE ... FROM anon
--   20260825070000  default DML on tables survived a narrowing GRANT
--   here            explicit authenticated EXECUTE survived REVOKE FROM public, anon
--
-- The lesson each time is the same: assert the catalogue, never the statement.
-- The Phase 5 contract test does exactly that for every function it adds.

revoke all on function public.pos_sale_receipt(uuid) from public, anon, authenticated;
grant execute on function public.pos_sale_receipt(uuid) to service_role;

comment on function public.pos_sale_receipt(uuid) is
  'Internal. Builds the customer-facing receipt for a sale with no authorization of its own -- callers must authorise first. Reachable only by checkout_pos_sale (SECURITY DEFINER) and service_role.';
