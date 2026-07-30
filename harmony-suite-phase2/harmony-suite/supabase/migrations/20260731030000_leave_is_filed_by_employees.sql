-- Filing leave is the employee's action; HR reviews it.
--
-- leave_requests_staff_all gave HR blanket INSERT, and the Leave Management
-- page had a "Submit Leave Request" button that let HR pick any employee and
-- file on their behalf. That makes HR both the requester and the approver of
-- the same request — the thing the approval split exists to prevent.
--
-- HR keeps everything else on the table: reading, approving, rejecting,
-- cancelling, and correcting. Only creating a request moves.
--
-- Administrators are excepted deliberately. Someone has to be able to record a
-- request that arrived by phone or on paper, and an administrator acting
-- outside the normal flow is already the pattern used for reassignment and
-- account recovery elsewhere in the schema.
create or replace function public.protect_leave_request_author()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Seeds, migrations, and service-role maintenance carry no JWT and aren't
  -- what this rule is about.
  if (select auth.uid()) is null then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  if new.employee_id is distinct from public.my_employee_id() then
    raise exception 'Leave requests are filed by the employee. HR reviews them.';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_protect_leave_request_author on public.leave_requests;
create trigger trg_protect_leave_request_author
  before insert on public.leave_requests
  for each row execute function public.protect_leave_request_author();
