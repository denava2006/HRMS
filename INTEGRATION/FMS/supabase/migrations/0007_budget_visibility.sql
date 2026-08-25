-- =============================================================================
-- Migration 0007: Budget visibility
--
-- Budgets were readable by every authenticated user, so an employee could pull
-- the whole budget dashboard straight from the API even though the sidebar
-- hides the link. Budget figures belong to Finance.
-- =============================================================================

drop policy if exists budgets_select on budgets;

create policy budgets_select on budgets
  for select to authenticated
  using (is_reviewer());

drop policy if exists allocations_select on budget_allocations;

create policy allocations_select on budget_allocations
  for select to authenticated
  using (is_reviewer());

-- -----------------------------------------------------------------------------
-- An employee's new request still has to be charged to the budget covering
-- their department — but they can no longer read the budgets table to find it.
-- This resolves the id on their behalf without exposing any amounts.
-- -----------------------------------------------------------------------------

create or replace function public.budget_for_department(dept uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select b.id
  from budgets b
  where b.status = 'active'
    and current_date between b.start_date and b.end_date
    and (b.department_id = dept or b.department_id is null)
  -- a department's own ceiling wins over the company-wide one
  order by (b.department_id is null), b.start_date desc
  limit 1;
$$;

grant execute on function public.budget_for_department(uuid) to authenticated, service_role;
