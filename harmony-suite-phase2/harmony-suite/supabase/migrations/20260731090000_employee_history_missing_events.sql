-- employee_history's event whitelist had fallen behind the code writing to it.
--
-- 'account_enabled' is inserted whenever HR re-enables a login
-- (useSetEmployeeAccountStatus), and 'password_reset' by the new reset flow.
-- Neither was in the constraint, so both inserts have been failing — silently,
-- because the calling code doesn't check the error on a history write. The
-- timeline simply never showed those events.
--
-- Widening the list is the fix; the constraint is worth keeping, since it is
-- what stops the timeline filling with one-off event names that no label map
-- knows how to render.
alter table public.employee_history
  drop constraint if exists employee_history_event_check,
  add constraint employee_history_event_check check (
    event = any (array[
      'record_created',
      'employee_id_generated',
      'account_created',
      'invitation_sent',
      'invitation_resent',
      'account_activated',
      'account_enabled',
      'account_disabled',
      'password_reset',
      'documents_uploaded',
      'department_assigned',
      'position_assigned',
      'status_updated',
      'information_updated'
    ])
  );
