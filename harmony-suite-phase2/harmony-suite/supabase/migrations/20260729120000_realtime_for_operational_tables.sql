-- Attendance, leave, and payroll screens subscribe to postgres_changes, but
-- their tables were never added to the supabase_realtime publication — only
-- the recruitment tables were. The subscriptions therefore connected happily
-- and then never fired, so a user had to refresh the page by hand to see their
-- own submission appear.
--
-- REPLICA IDENTITY FULL so the payload carries the old row too: the portal
-- filters on employee_id, and on DELETE that column is only present when the
-- full row is replicated. Matches what applications already does.
alter table public.attendance_records replica identity full;
alter table public.leave_requests replica identity full;
alter table public.leave_balances replica identity full;
alter table public.payroll_records replica identity full;
alter table public.payroll_periods replica identity full;
alter table public.change_requests replica identity full;

alter publication supabase_realtime add table public.attendance_records;
alter publication supabase_realtime add table public.leave_requests;
alter publication supabase_realtime add table public.leave_balances;
alter publication supabase_realtime add table public.payroll_records;
alter publication supabase_realtime add table public.payroll_periods;
alter publication supabase_realtime add table public.change_requests;
