-- The inventory tables were writable by anon and authenticated at the privilege
-- layer.
--
-- 20260825060000 ended with `grant select on ... to anon, authenticated,
-- service_role`, which reads as though it limited them to reading. It did not
-- add anything. The catalogue said:
--
--   anon          DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
--   authenticated DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
--
-- because 20260716070000_grant_table_privileges_to_api_roles.sql set
-- ALTER DEFAULT PRIVILEGES ... ON TABLES TO anon, authenticated, service_role.
-- Every table created in `public` since then is born with full DML, and GRANT
-- cannot narrow what is already held -- only REVOKE can.
--
-- This is the third form of the same trap in this project: PUBLIC's default
-- EXECUTE on functions (20260825030000), an explicit anon EXECUTE from ALTER
-- DEFAULT PRIVILEGES (20260813010000), and now default DML on tables.
--
-- Nothing was exposed. Neither table has an INSERT, UPDATE or DELETE policy for
-- any role, so RLS reduced every such statement to zero rows. But the brief for
-- these two tables was "no direct access", and a privilege that exists is one a
-- future permissive policy would silently activate. RLS should be the second
-- line here, not the only one.
--
-- Elsewhere in this system blanket grants plus RLS is the deliberate house
-- style (20260716070000 explains why). Inventory is the exception on purpose:
-- the balance may only move through receive_pos_stock / adjust_pos_stock, so
-- there is no legitimate direct write to permit.
--
-- Forward-only: 20260825060000 is left exactly as it was applied.

revoke all privileges on table public.pos_branch_inventory from anon, authenticated;
revoke all privileges on table public.pos_inventory_movements from anon, authenticated;

-- Reading is still governed by RLS, which admits Administrators only; POS staff
-- read through the SECURITY DEFINER functions, which run as the owner and so
-- need no grant of their own.
grant select on table public.pos_branch_inventory to anon, authenticated;
grant select on table public.pos_inventory_movements to anon, authenticated;

-- service_role keeps write access: it is the identity a future FMS receiving
-- job or backfill would use, and it never reaches a browser.
grant select, insert, update, delete on table public.pos_branch_inventory to service_role;
grant select, insert, update, delete on table public.pos_inventory_movements to service_role;
