
-- anon_view_departments/anon_view_positions are scoped to the anon role only
-- (RLS role-scoping, not a blanket "public read") -- an authenticated employee
-- session doesn't match `anon`, so without this, the departments/positions
-- names embedded through the employee's own employees row (Navbar, Work
-- Information widget, etc.) would silently come back null under RLS.
create policy departments_employee_select on departments
  for select using (is_active_employee());

create policy positions_employee_select on positions
  for select using (is_active_employee());

