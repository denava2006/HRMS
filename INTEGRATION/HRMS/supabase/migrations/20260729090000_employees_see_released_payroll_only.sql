-- Employees could see their payroll while it was still a draft — figures no
-- one had checked, before HR Staff reviewed them or the HR Manager approved
-- and released them. A draft can still be adjusted (or bounced back to draft
-- by an adjustment), so showing it is both wrong and alarming: an employee
-- would see a net salary that later changes.
--
-- Payroll is only an employee's business once it is released:
--   draft     still being checked   -> HR only
--   reviewed  approved, not yet out -> HR only
--   released  final                 -> visible to the employee
--
-- HR-side access is unaffected: payroll_records_staff_select still covers the
-- whole lifecycle for admin/HR staff/HR manager.
drop policy payroll_records_self_select on public.payroll_records;

create policy payroll_records_self_select on public.payroll_records
  for select using (
    is_active_employee()
    and employee_id = my_employee_id()
    and status = 'released'::payroll_status
  );

-- A payslip only exists once payroll is released, but scope it to released
-- records explicitly rather than relying on that invariant holding forever.
drop policy payslips_self_select on public.payslips;

create policy payslips_self_select on public.payslips
  for select using (
    is_active_employee()
    and payroll_record_id in (
      select id from public.payroll_records
      where employee_id = my_employee_id() and status = 'released'::payroll_status
    )
  );
