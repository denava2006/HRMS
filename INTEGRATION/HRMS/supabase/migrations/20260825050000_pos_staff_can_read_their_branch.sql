-- POS staff could not read the branch they work at.
--
-- public.branches has had two policies since 20260729060000: staff may select
-- (is_active_staff(), meaning admin / hr_staff / hr_manager) and admin may
-- manage. A cashier is an `employee`, so they matched neither -- branches came
-- back empty for them.
--
-- That was invisible until a POS screen needed the branch itself rather than
-- just an id. The catalogue page resolves "which of my branches am I looking
-- at" from this table, so for a cashier or POS Manager it resolved to nothing
-- and the page correctly reported that they were assigned to no branch. The
-- assignment was there; the branch row behind it was not readable.
--
-- Found by driving the app as a manager, not by a test: every automated check
-- passed, because the contract tests exercise the RPCs (which are SECURITY
-- DEFINER and so never saw this) and the component tests mock useBranches.
--
-- The fix is a third, additive policy. Policies are OR-ed, so staff and admin
-- access is unchanged; this only adds "a branch you actively work at".
-- has_pos_role() already returns true for an Administrator at any branch and
-- re-checks that the profile behind the assignment is still active, so a
-- deactivated account stops seeing the branch at the same moment it loses the
-- till.
--
-- This is needed beyond the catalogue: a receipt prints the branch's name,
-- address and phone, and the till that prints it is run by exactly these
-- people.

create policy branches_pos_select on public.branches
  for select to authenticated
  using (public.has_pos_role(id, array['manager', 'cashier']::public.pos_role[]));

comment on policy branches_pos_select on public.branches is
  'POS staff may read the branches they are actively assigned to -- the catalogue and the receipt both need the branch itself, not just its id.';
