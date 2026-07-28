
-- Centralizes "Leave Request Submitted" auditing in the DB so it fires no
-- matter who submits (HR on an employee's behalf, or the employee themselves
-- via the portal) -- the client-side insert in useCreateLeaveRequest silently
-- failed for any non-staff caller anyway, since audit_logs_staff_insert
-- requires is_active_staff(). One SECURITY DEFINER trigger replaces it and
-- can never be skipped.
create or replace function public.handle_leave_request_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_logs (actor_id, action, table_name, record_id)
  values (auth.uid(), 'Leave Request Submitted', 'leave_requests', new.employee_id);
  return new;
end;
$$;

drop trigger if exists on_leave_request_submitted on leave_requests;
create trigger on_leave_request_submitted
  after insert on leave_requests
  for each row
  execute function public.handle_leave_request_submitted();

-- Attendance had no audit trail at all before (HR-recorded or otherwise) --
-- this fills that gap for both HR-side recording and employee self-service
-- Time In/Time Out, matching the same always-fires trigger pattern.
create or replace function public.handle_attendance_recorded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into audit_logs (actor_id, action, table_name, record_id)
    values (auth.uid(), 'Attendance Recorded', 'attendance_records', new.employee_id);
  elsif tg_op = 'UPDATE' and old.time_out is null and new.time_out is not null then
    insert into audit_logs (actor_id, action, table_name, record_id)
    values (auth.uid(), 'Attendance Updated', 'attendance_records', new.employee_id);
  end if;
  return new;
end;
$$;

drop trigger if exists on_attendance_recorded on attendance_records;
create trigger on_attendance_recorded
  after insert or update on attendance_records
  for each row
  execute function public.handle_attendance_recorded();

