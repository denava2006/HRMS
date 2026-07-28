-- HR staff (not just admins) may create/edit employee records per spec, which
-- includes disabling/activating an employee's login. Scoped strictly to
-- role='employee' rows so HR/Admin accounts stay admin-only-managed via the
-- existing profiles_admin_manage policy.
create policy profiles_staff_manage_employee_accounts on public.profiles
  for update
  using (public.is_active_staff() and role = 'employee')
  with check (public.is_active_staff() and role = 'employee');
