-- Postgres must evaluate every RLS policy that applies to a role for a given
-- command, even ones the role won't ultimately satisfy, when combining them
-- with OR. is_active_staff()/is_admin() back the staff/admin-only policies
-- that coexist on job_postings, departments, and positions alongside the new
-- anon-facing SELECT policies (anon_view_open_postings, anon_view_departments,
-- anon_view_positions). Without EXECUTE, Postgres throws "permission denied
-- for function is_active_staff" while evaluating the OTHER policy — even
-- though the anon-scoped policy alone would have allowed the read — which
-- surfaced as a 401 on every anon job_postings/departments/positions query.
--
-- This grant only lets anon CALL the function; the function itself still
-- reads auth.uid(), which is null for anon, so it safely evaluates to false
-- and grants no additional access.
grant execute on function public.is_active_staff() to anon;
grant execute on function public.is_admin() to anon;

