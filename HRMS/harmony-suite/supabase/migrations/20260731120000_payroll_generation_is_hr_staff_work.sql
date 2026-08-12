-- Preparing payroll and deciding on it are two different jobs.
--
-- The approval gate already stopped HR Staff approving, rejecting, or
-- releasing (20260731010000). The other half was still open: nothing stopped an
-- HR Manager creating the period, generating the figures, and then approving
-- their own work — which is the same person on both sides of the review the
-- split exists to create.
--
-- HR Staff prepares: create period, generate, adjust, recompute, submit.
-- HR Manager decides: approve, reject, release.
--
-- Administrators are outside both rules, as everywhere else in this schema.

create or replace function public.protect_payroll_generation()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Seeds, migrations, and service-role maintenance carry no JWT and aren't
  -- what this rule is about. Reaching here through the API always requires a
  -- session, since the payroll policies demand is_active_staff() first.
  if (select auth.uid()) is null then
    return new;
  end if;

  if not public.is_hr_staff_or_admin() then
    raise exception 'Only HR Staff can create or generate payroll. HR Managers review it.';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_protect_payroll_period_generation on public.payroll_periods;
create trigger trg_protect_payroll_period_generation
  before insert on public.payroll_periods
  for each row execute function public.protect_payroll_generation();

drop trigger if exists trg_protect_payroll_record_generation on public.payroll_records;
create trigger trg_protect_payroll_record_generation
  before insert on public.payroll_records
  for each row execute function public.protect_payroll_generation();

-- Line items are the adjust flow's other half — allowing them while blocking
-- the record update would let a manager change a payslip's contents without
-- changing its totals.
drop trigger if exists trg_protect_payroll_line_item_generation on public.payroll_line_items;
create trigger trg_protect_payroll_line_item_generation
  before insert or update or delete on public.payroll_line_items
  for each row execute function public.protect_payroll_generation();

-- ---------- A reviewer changes the decision, not the figures ----------
-- Approving, rejecting, and releasing touch a known, small set of columns.
-- Anything else on a payroll record is a recomputation, which belongs to
-- whoever prepared it. Listing the reviewer's columns rather than the
-- preparer's means a column added later is protected by default.
create or replace function public.protect_payroll_amounts()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if public.is_hr_staff_or_admin() then
    return new;
  end if;

  if to_jsonb(new) - 'status' - 'reviewed_by' - 'reviewed_at' - 'rejection_reason'
       - 'released_at' - 'updated_at'
     is distinct from
     to_jsonb(old) - 'status' - 'reviewed_by' - 'reviewed_at' - 'rejection_reason'
       - 'released_at' - 'updated_at'
  then
    raise exception 'HR Managers can approve, reject, or release payroll, but not change its figures. Send it back to HR Staff instead.';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_protect_payroll_amounts on public.payroll_records;
create trigger trg_protect_payroll_amounts
  before update on public.payroll_records
  for each row execute function public.protect_payroll_amounts();
