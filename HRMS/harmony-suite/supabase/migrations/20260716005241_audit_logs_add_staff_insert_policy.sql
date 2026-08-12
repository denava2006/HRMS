create policy audit_logs_staff_insert on public.audit_logs
  for insert
  with check (public.is_active_staff());
