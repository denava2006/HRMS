-- What POS roles the signed-in account actually holds, and where.
--
-- `my_pos_branches()` answers "which branches" and `has_pos_access()` answers
-- "at all", but neither carries the role. The POS portal now needs it: a
-- cashier and a POS Manager see different navigation, and a person can be a
-- Manager at one branch and a Cashier at another. Reducing that to a single
-- boolean would give someone manager tools at a branch where they are a
-- cashier.
--
-- So this returns the pairs, and the client keeps them as pairs.
--
-- This is a convenience for the interface only. Every operation continues to
-- authorise itself in the database -- has_pos_role(branch, roles) is still what
-- decides, and a client that lied about its own roles would gain nothing.
--
-- Administrators are deliberately absent from the result, exactly as they are
-- absent from pos_branch_assignments: their POS reach comes from profiles.role
-- and is not branch-scoped. An empty result from an Administrator means "not
-- assigned anywhere", never "no access" -- has_pos_access() is the question
-- that answers that.

create or replace function public.my_pos_assignments()
returns table (branch_id uuid, pos_role public.pos_role)
language sql
stable
security definer
set search_path = ''
as $$
  select a.branch_id, a.pos_role
  from public.pos_branch_assignments a
  join public.profiles p on p.id = a.profile_id
  where a.profile_id = (select auth.uid())
    and a.status = 'active'
    -- The same profile check has_pos_role() makes: an assignment against a
    -- deactivated account grants nothing, so it must not appear here either.
    and p.status = 'active';
$$;

comment on function public.my_pos_assignments() is
  'The signed-in account''s active POS assignments as (branch_id, pos_role) pairs. Interface convenience only -- has_pos_role() remains the authorization.';

-- Both revokes, then the grant. PUBLIC holds EXECUTE on a new function by
-- default, and this database also grants anon explicitly through ALTER DEFAULT
-- PRIVILEGES; neither revoke alone is sufficient here, and the contract test
-- asserts the resulting catalogue rather than these statements.
revoke all on function public.my_pos_assignments() from public, anon;
grant execute on function public.my_pos_assignments() to authenticated, service_role;
