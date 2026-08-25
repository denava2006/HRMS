-- =============================================================================
-- Migration 0005: Budget reservation (encumbrance)
--
-- A budget must not shrink when a request is merely submitted or validated —
-- the request can still be returned or rejected. Money is committed only once
-- the Finance Manager gives final approval:
--
--   Submitted -> Finance Review -> Finance Approval -> [reserve] -> Accountant
--     -> Completed [reservation released, recorded as actual spending]
--
-- `reserved` is DERIVED from request status rather than stored on the budget.
-- One source of truth means it can never drift: a reservation appears the
-- instant a request reaches pending_accountant and disappears the instant it
-- leaves — whether it was paid, rejected or cancelled. It also makes double
-- deduction impossible: at completion the request drops out of `reserved` at
-- the same moment the expense lands in `spent`, so `remaining` does not move.
-- =============================================================================

create or replace view budget_status as
select
  b.id,
  b.name,
  b.department_id,
  d.name                as department_name,
  b.category_id,
  b.period,
  b.fiscal_year,
  b.amount,
  b.allocated,
  b.spent,
  coalesce(res.total, 0) as reserved,
  -- what an approver may still commit against this budget
  b.amount - b.spent - coalesce(res.total, 0) as remaining,
  b.start_date,
  b.end_date,
  b.status,
  b.alert_threshold,
  b.created_by,
  b.created_at,
  b.updated_at
from budgets b
left join departments d on d.id = b.department_id
left join lateral (
  select coalesce(sum(r.amount), 0) as total
  from requests r
  where r.status = 'pending_accountant'      -- past final approval, not yet paid
    and (
      r.budget_id = b.id
      -- Requests created before budgets were linked carry no budget_id; fall
      -- back to the department budget whose period covers them.
      or (
        r.budget_id is null
        and r.department_id is not distinct from b.department_id
        and r.created_at::date between b.start_date and b.end_date
      )
    )
) res on true;

-- Evaluate RLS as the querying user, matching the other views in this schema.
alter view budget_status set (security_invoker = true);

grant select on budget_status to authenticated, service_role;
