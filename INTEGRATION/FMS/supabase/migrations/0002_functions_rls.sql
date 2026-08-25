-- =============================================================================
-- Migration 0002: Helper functions, triggers, and Row Level Security policies
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Role helper functions (SECURITY DEFINER so they bypass RLS and never recurse
-- when referenced from within a policy on the profiles table).
-- -----------------------------------------------------------------------------

create or replace function public.current_role_key()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.has_role(variadic roles user_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role_key() = any(roles);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role_key() = 'administrator';
$$;

-- Any non-employee is a "reviewer" who can see the full request pipeline.
create or replace function public.is_reviewer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role_key() <> 'employee', false);
$$;

-- -----------------------------------------------------------------------------
-- New-auth-user hook: create a matching profile row automatically.
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, employee_no)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'employee'),
    new.raw_user_meta_data->>'employee_no'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- updated_at maintenance
-- -----------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_profiles_touch  before update on profiles
  for each row execute function public.touch_updated_at();
create trigger trg_budgets_touch   before update on budgets
  for each row execute function public.touch_updated_at();
create trigger trg_requests_touch  before update on requests
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Human-readable reference numbers
-- -----------------------------------------------------------------------------

create sequence if not exists seq_purchase_request;
create sequence if not exists seq_reimbursement_request;
create sequence if not exists seq_payment;
create sequence if not exists seq_expense;
create sequence if not exists seq_income;
create sequence if not exists seq_journal;

create or replace function public.set_request_no()
returns trigger
language plpgsql
as $$
begin
  if new.request_no is null then
    if new.type = 'purchase' then
      new.request_no := 'PR-' || extract(year from now())::int || '-' ||
        lpad(nextval('seq_purchase_request')::text, 4, '0');
    else
      new.request_no := 'RB-' || extract(year from now())::int || '-' ||
        lpad(nextval('seq_reimbursement_request')::text, 4, '0');
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_request_no before insert on requests
  for each row execute function public.set_request_no();

-- One function per table: a shared function cannot reference new.payment_no
-- when firing on a table without that column (PL/pgSQL plans the whole
-- expression, so a short-circuited AND does not prevent the missing-field error).
create or replace function public.set_payment_no()
returns trigger language plpgsql as $$
begin
  if new.payment_no is null then
    new.payment_no := 'PAY-' || extract(year from now())::int || '-' ||
      lpad(nextval('seq_payment')::text, 4, '0');
  end if;
  return new;
end;
$$;

create or replace function public.set_expense_no()
returns trigger language plpgsql as $$
begin
  if new.reference_no is null then
    new.reference_no := 'EXP-' || extract(year from now())::int || '-' ||
      lpad(nextval('seq_expense')::text, 4, '0');
  end if;
  return new;
end;
$$;

create or replace function public.set_income_no()
returns trigger language plpgsql as $$
begin
  if new.reference_no is null then
    new.reference_no := 'INC-' || extract(year from now())::int || '-' ||
      lpad(nextval('seq_income')::text, 4, '0');
  end if;
  return new;
end;
$$;

create or replace function public.set_journal_no()
returns trigger language plpgsql as $$
begin
  if new.entry_no is null then
    new.entry_no := 'JE-' || extract(year from now())::int || '-' ||
      lpad(nextval('seq_journal')::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger trg_payment_no before insert on payments
  for each row execute function public.set_payment_no();
create trigger trg_expense_no before insert on expenses
  for each row execute function public.set_expense_no();
create trigger trg_income_no  before insert on income
  for each row execute function public.set_income_no();
create trigger trg_journal_no before insert on journal_entries
  for each row execute function public.set_journal_no();

-- -----------------------------------------------------------------------------
-- Keep budgets.spent in sync with the expenses charged against them.
-- -----------------------------------------------------------------------------

create or replace function public.sync_budget_spent()
returns trigger
language plpgsql
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
create trigger trg_expense_budget_sync
  after insert or update or delete on expenses
  for each row execute function public.sync_budget_spent();

-- -----------------------------------------------------------------------------
-- Views should evaluate RLS as the querying user, not the view owner.
-- -----------------------------------------------------------------------------

alter view purchase_requests set (security_invoker = true);
alter view reimbursement_requests set (security_invoker = true);

-- =============================================================================
-- Row Level Security
-- =============================================================================

alter table roles                enable row level security;
alter table departments          enable row level security;
alter table profiles             enable row level security;
alter table categories           enable row level security;
alter table vendors              enable row level security;
alter table accounts             enable row level security;
alter table budgets              enable row level security;
alter table budget_allocations   enable row level security;
alter table requests             enable row level security;
alter table request_attachments  enable row level security;
alter table request_approvals    enable row level security;
alter table income               enable row level security;
alter table expenses             enable row level security;
alter table payments             enable row level security;
alter table journal_entries      enable row level security;
alter table notifications        enable row level security;
alter table audit_logs           enable row level security;
alter table reports              enable row level security;

-- --- profiles ---------------------------------------------------------------
create policy profiles_select on profiles
  for select to authenticated using (true);
create policy profiles_update_self on profiles
  for update to authenticated using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());
create policy profiles_insert_admin on profiles
  for insert to authenticated with check (is_admin() or id = auth.uid());
create policy profiles_delete_admin on profiles
  for delete to authenticated using (is_admin());

-- --- reference tables: readable by all, writable by admins (+ finance mgr) --
create policy roles_select on roles for select to authenticated using (true);
create policy roles_write  on roles for all to authenticated
  using (is_admin()) with check (is_admin());

create policy departments_select on departments for select to authenticated using (true);
create policy departments_write on departments for all to authenticated
  using (is_admin()) with check (is_admin());

create policy categories_select on categories for select to authenticated using (true);
create policy categories_write on categories for all to authenticated
  using (has_role('administrator', 'finance_manager', 'finance_staff'))
  with check (has_role('administrator', 'finance_manager', 'finance_staff'));

create policy vendors_select on vendors for select to authenticated using (true);
create policy vendors_write on vendors for all to authenticated
  using (has_role('administrator', 'finance_manager', 'finance_staff'))
  with check (has_role('administrator', 'finance_manager', 'finance_staff'));

create policy accounts_select on accounts for select to authenticated using (is_reviewer());
create policy accounts_write on accounts for all to authenticated
  using (has_role('administrator', 'finance_manager', 'accountant'))
  with check (has_role('administrator', 'finance_manager', 'accountant'));

-- --- budgets ----------------------------------------------------------------
create policy budgets_select on budgets for select to authenticated using (true);
create policy budgets_write on budgets for all to authenticated
  using (has_role('administrator', 'finance_manager', 'finance_staff'))
  with check (has_role('administrator', 'finance_manager', 'finance_staff'));

create policy allocations_select on budget_allocations for select to authenticated using (true);
create policy allocations_write on budget_allocations for all to authenticated
  using (has_role('administrator', 'finance_manager', 'finance_staff'))
  with check (has_role('administrator', 'finance_manager', 'finance_staff'));

-- --- requests: owner sees own, reviewers see all ----------------------------
create policy requests_select on requests
  for select to authenticated
  using (requester_id = auth.uid() or is_reviewer());
create policy requests_insert on requests
  for insert to authenticated
  with check (requester_id = auth.uid());
create policy requests_update on requests
  for update to authenticated
  using (requester_id = auth.uid() or is_reviewer())
  with check (requester_id = auth.uid() or is_reviewer());
create policy requests_delete on requests
  for delete to authenticated
  using (requester_id = auth.uid() or is_admin());

-- --- request attachments (visibility mirrors the parent request) ------------
create policy attachments_select on request_attachments
  for select to authenticated
  using (exists (
    select 1 from requests r
    where r.id = request_id and (r.requester_id = auth.uid() or is_reviewer())
  ));
create policy attachments_insert on request_attachments
  for insert to authenticated with check (uploaded_by = auth.uid());
create policy attachments_delete on request_attachments
  for delete to authenticated
  using (uploaded_by = auth.uid() or is_admin());

-- --- request approvals (the workflow history) -------------------------------
create policy approvals_select on request_approvals
  for select to authenticated
  using (exists (
    select 1 from requests r
    where r.id = request_id and (r.requester_id = auth.uid() or is_reviewer())
  ));
create policy approvals_insert on request_approvals
  for insert to authenticated with check (actor_id = auth.uid());

-- --- ledger: income / expenses / payments / journal (reviewers only) --------
create policy income_select on income for select to authenticated using (is_reviewer());
create policy income_write on income for all to authenticated
  using (has_role('administrator', 'finance_manager', 'finance_staff', 'accountant'))
  with check (has_role('administrator', 'finance_manager', 'finance_staff', 'accountant'));

create policy expenses_select on expenses for select to authenticated using (is_reviewer());
create policy expenses_write on expenses for all to authenticated
  using (has_role('administrator', 'finance_manager', 'finance_staff', 'accountant'))
  with check (has_role('administrator', 'finance_manager', 'finance_staff', 'accountant'));

create policy payments_select on payments for select to authenticated using (is_reviewer());
create policy payments_write on payments for all to authenticated
  using (has_role('administrator', 'finance_manager', 'accountant'))
  with check (has_role('administrator', 'finance_manager', 'accountant'));

create policy journal_select on journal_entries for select to authenticated using (is_reviewer());
create policy journal_write on journal_entries for all to authenticated
  using (has_role('administrator', 'accountant'))
  with check (has_role('administrator', 'accountant'));

-- --- notifications: each user sees and manages only their own ---------------
create policy notifications_select on notifications
  for select to authenticated using (user_id = auth.uid());
create policy notifications_update on notifications
  for update to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy notifications_insert on notifications
  for insert to authenticated with check (true);
create policy notifications_delete on notifications
  for delete to authenticated using (user_id = auth.uid());

-- --- audit logs: admins & finance managers read; app inserts ----------------
create policy audit_select on audit_logs
  for select to authenticated
  using (has_role('administrator', 'finance_manager'));
create policy audit_insert on audit_logs
  for insert to authenticated with check (true);

-- --- reports ----------------------------------------------------------------
create policy reports_select on reports for select to authenticated using (is_reviewer());
create policy reports_write on reports for all to authenticated
  using (is_reviewer()) with check (is_reviewer());

-- =============================================================================
-- Table privileges
--
-- This project does not auto-expose new tables to the Data API roles, so the
-- base GRANTs must be explicit. RLS (above) still governs which *rows* each
-- role may touch — these grants only open the tables to the API roles at all.
-- =============================================================================

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- Future tables/sequences (should any be added later in the same schema).
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;
