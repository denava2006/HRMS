-- =============================================================================
-- Migration 0004: Budget ownership and real-time utilization
--
-- Who handles the money, enforced in the database and not just the UI:
--   Finance Manager — sets the ceilings (insert/update/close budgets).
--   Finance Staff   — draws allocations from a ceiling the Manager set.
--   Administrator   — manages users and access, never amounts.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Budgets: only the Finance Manager holds the pen.
-- (The separate budgets_select policy still lets every authenticated user read
--  them, since policies for a command are OR'd together.)
-- -----------------------------------------------------------------------------

drop policy if exists budgets_write on budgets;

create policy budgets_write on budgets
  for all to authenticated
  using (has_role('finance_manager'))
  with check (has_role('finance_manager'));

-- -----------------------------------------------------------------------------
-- Allocations: Finance Staff record them, the Finance Manager can also correct
-- or remove them.
-- -----------------------------------------------------------------------------

drop policy if exists allocations_write on budget_allocations;

create policy allocations_insert on budget_allocations
  for insert to authenticated
  with check (has_role('finance_manager', 'finance_staff') and created_by = auth.uid());

create policy allocations_update on budget_allocations
  for update to authenticated
  using (has_role('finance_manager'))
  with check (has_role('finance_manager'));

create policy allocations_delete on budget_allocations
  for delete to authenticated
  using (has_role('finance_manager'));

-- -----------------------------------------------------------------------------
-- budgets.spent is maintained by a trigger that fires when the Accountant
-- records an expense — but the Accountant may not write budgets directly, and a
-- plain trigger function runs as the calling user. Without SECURITY DEFINER the
-- RLS check above filters the row out and the update silently does nothing, so
-- utilization never moves. Same reasoning for the allocation trigger below.
-- -----------------------------------------------------------------------------

create or replace function public.sync_budget_spent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.budget_id is not null then
      update budgets set spent = spent + new.amount where id = new.budget_id;
    end if;
  elsif tg_op = 'DELETE' then
    if old.budget_id is not null then
      update budgets set spent = spent - old.amount where id = old.budget_id;
    end if;
  elsif tg_op = 'UPDATE' then
    if old.budget_id is not null then
      update budgets set spent = spent - old.amount where id = old.budget_id;
    end if;
    if new.budget_id is not null then
      update budgets set spent = spent + new.amount where id = new.budget_id;
    end if;
  end if;
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Keep budgets.allocated in step with the allocation rows, the same way
-- budgets.spent tracks expenses.
-- -----------------------------------------------------------------------------

create or replace function public.sync_budget_allocated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update budgets set allocated = allocated + new.amount where id = new.budget_id;
  elsif tg_op = 'DELETE' then
    update budgets set allocated = allocated - old.amount where id = old.budget_id;
  elsif tg_op = 'UPDATE' then
    update budgets set allocated = allocated - old.amount where id = old.budget_id;
    update budgets set allocated = allocated + new.amount where id = new.budget_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_allocation_budget_sync on budget_allocations;
create trigger trg_allocation_budget_sync
  after insert or update or delete on budget_allocations
  for each row execute function public.sync_budget_allocated();
