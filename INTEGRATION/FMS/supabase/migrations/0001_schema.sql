-- =============================================================================
-- Fagle Financial Services Inc. — Finance Management System (FMS)
-- Migration 0001: Core schema (extensions, enums, tables, indexes)
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Enumerated types
-- -----------------------------------------------------------------------------

-- The five system roles. Each stage of the approval chain maps to a role.
create type user_role as enum (
  'employee',
  'finance_staff',
  'finance_manager',
  'accountant',
  'administrator'
);

-- A request is either a purchase request or a reimbursement request. Both flow
-- through the same approval chain, so they share one table keyed by this type.
create type request_type as enum ('purchase', 'reimbursement');

-- The lifecycle of a request as it moves through the approval chain.
create type request_status as enum (
  'draft',                    -- being prepared by the employee
  'pending_finance_staff',    -- submitted, awaiting Finance Staff review
  'pending_finance_manager',  -- validated, awaiting Finance Manager
  'pending_accountant',       -- approved, awaiting Accountant to pay & record
  'completed',                -- paid and recorded — workflow complete
  'returned',                 -- sent back for revision
  'rejected',                 -- rejected at some stage
  'cancelled'                 -- withdrawn by the requester
);

-- Every action taken on a request is logged with one of these verbs.
create type approval_action as enum (
  'submitted',
  'validated',
  'final_approved',
  'completed',
  'returned',
  'rejected',
  'cancelled'
);

create type payment_method as enum (
  'bank_transfer',
  'check',
  'cash',
  'gcash',
  'credit_card'
);

create type transaction_type as enum ('income', 'expense');

create type budget_period as enum ('monthly', 'quarterly', 'yearly');

create type notification_type as enum (
  'info',
  'approval',
  'rejection',
  'payment',
  'system'
);

-- -----------------------------------------------------------------------------
-- Reference / master data
-- -----------------------------------------------------------------------------

-- Descriptive catalog of roles for the admin UI. `key` is the source of truth
-- that matches profiles.role, so RLS can rely on the enum column directly.
create table roles (
  id          uuid primary key default gen_random_uuid(),
  key         user_role not null unique,
  name        text not null,
  description text,
  rank        int not null default 0,        -- seniority / workflow order
  permissions jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create table departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  code        text not null unique,
  description text,
  manager_id  uuid,                            -- FK added after profiles exists
  created_at  timestamptz not null default now()
);

-- Application-level user record, one row per auth.users row.
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  employee_no   text unique,
  full_name     text not null,
  email         text not null,
  role          user_role not null default 'employee',
  department_id uuid references departments(id) on delete set null,
  position      text,
  phone         text,
  avatar_url    text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table departments
  add constraint departments_manager_fk
  foreign key (manager_id) references profiles(id) on delete set null;

create table categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        transaction_type not null,       -- income or expense category
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (name, type)
);

create table vendors (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  contact_person text,
  email          text,
  phone          text,
  address        text,
  tin            text,                          -- tax identification number
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

-- Chart of accounts / company bank accounts. `balance` is the running balance
-- the Accountant maintains.
create table accounts (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  account_type   text not null default 'bank', -- asset|liability|equity|revenue|expense|bank
  account_number text,
  balance        numeric(14,2) not null default 0,
  currency       text not null default 'PHP',
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Budgeting
-- -----------------------------------------------------------------------------

create table budgets (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  department_id uuid references departments(id) on delete set null,
  category_id   uuid references categories(id) on delete set null,
  period        budget_period not null default 'monthly',
  fiscal_year   int not null default extract(year from now()),
  amount        numeric(14,2) not null default 0,   -- total budget
  allocated     numeric(14,2) not null default 0,   -- allocated out
  spent         numeric(14,2) not null default 0,   -- consumed by expenses
  start_date    date,
  end_date      date,
  status        text not null default 'active',      -- active|closed
  alert_threshold int not null default 80,           -- % usage that triggers an alert
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table budget_allocations (
  id            uuid primary key default gen_random_uuid(),
  budget_id     uuid not null references budgets(id) on delete cascade,
  amount        numeric(14,2) not null,
  reference     text,
  allocated_to  text,
  note          text,
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Requests (unified purchase + reimbursement workflow core)
-- -----------------------------------------------------------------------------

create table requests (
  id            uuid primary key default gen_random_uuid(),
  request_no    text unique,                        -- auto-filled: PR-2026-0001 / RB-2026-0001
  type          request_type not null,
  title         text not null,
  description   text,
  justification text,
  requester_id  uuid not null references profiles(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  vendor_id     uuid references vendors(id) on delete set null,
  category_id   uuid references categories(id) on delete set null,
  budget_id     uuid references budgets(id) on delete set null,
  amount        numeric(14,2) not null default 0,
  priority      text not null default 'medium',     -- low|medium|high
  needed_by     date,
  expense_date  date,                               -- for reimbursements
  status        request_status not null default 'draft',
  payment_schedule date,                            -- assigned by Finance Staff
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table request_attachments (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references requests(id) on delete cascade,
  file_name   text not null,
  file_path   text not null,                        -- Supabase Storage path
  file_type   text,
  file_size   int,
  kind        text not null default 'other',        -- receipt|quotation|proof_of_payment|other
  uploaded_by uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Immutable log of every step a request goes through (the approval history).
create table request_approvals (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null references requests(id) on delete cascade,
  actor_id       uuid references profiles(id) on delete set null,
  action         approval_action not null,
  role_at_action user_role,
  from_status    request_status,
  to_status      request_status,
  remarks        text,
  created_at     timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Ledger: income, expenses, payments, journal entries
-- -----------------------------------------------------------------------------

create table income (
  id            uuid primary key default gen_random_uuid(),
  reference_no  text unique,
  source        text not null,
  description   text,
  category_id   uuid references categories(id) on delete set null,
  account_id    uuid references accounts(id) on delete set null,
  department_id uuid references departments(id) on delete set null,
  amount        numeric(14,2) not null,
  received_date date not null default current_date,
  recorded_by   uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create table expenses (
  id             uuid primary key default gen_random_uuid(),
  reference_no   text unique,
  request_id     uuid references requests(id) on delete set null,
  description    text not null,
  category_id    uuid references categories(id) on delete set null,
  account_id     uuid references accounts(id) on delete set null,
  department_id  uuid references departments(id) on delete set null,
  budget_id      uuid references budgets(id) on delete set null,
  vendor_id      uuid references vendors(id) on delete set null,
  amount         numeric(14,2) not null,
  expense_date   date not null default current_date,
  payment_status text not null default 'unpaid',    -- unpaid|scheduled|paid
  recorded_by    uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

create table payments (
  id             uuid primary key default gen_random_uuid(),
  payment_no     text unique,
  request_id     uuid references requests(id) on delete set null,
  expense_id     uuid references expenses(id) on delete set null,
  amount         numeric(14,2) not null,
  method         payment_method not null default 'bank_transfer',
  reference_number text,
  account_id     uuid references accounts(id) on delete set null,
  proof_path     text,                              -- proof-of-payment file
  status         text not null default 'scheduled', -- scheduled|processing|paid|failed
  scheduled_date date,
  paid_at        timestamptz,
  processed_by   uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

-- Double-entry-style records the Accountant posts for completed transactions.
create table journal_entries (
  id                uuid primary key default gen_random_uuid(),
  entry_no          text unique,
  description       text not null,
  entry_date        date not null default current_date,
  request_id        uuid references requests(id) on delete set null,
  expense_id        uuid references expenses(id) on delete set null,
  income_id         uuid references income(id) on delete set null,
  debit_account_id  uuid references accounts(id) on delete set null,
  credit_account_id uuid references accounts(id) on delete set null,
  amount            numeric(14,2) not null,
  period            text,                            -- e.g. '2026-07'
  posted_by         uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Notifications, audit logs, saved reports
-- -----------------------------------------------------------------------------

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  title      text not null,
  body       text,
  type       notification_type not null default 'info',
  link       text,                                  -- in-app route to open
  request_id uuid references requests(id) on delete cascade,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

create table audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references profiles(id) on delete set null,
  action      text not null,                        -- created|updated|deleted|login|approved...
  entity_type text,                                 -- table / module name
  entity_id   uuid,
  description text,
  changes     jsonb,                                -- before/after snapshot
  ip_address  text,
  created_at  timestamptz not null default now()
);

create table reports (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  type         text not null,                       -- income|expense|budget|department|monthly|yearly
  params       jsonb not null default '{}'::jsonb,
  period       text,
  file_path    text,
  generated_by uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Compatibility views: expose purchase & reimbursement requests as their own
-- "tables" (as named in the project spec) while keeping one workflow engine.
-- -----------------------------------------------------------------------------

create view purchase_requests as
  select * from requests where type = 'purchase';

create view reimbursement_requests as
  select * from requests where type = 'reimbursement';

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

create index idx_profiles_role         on profiles(role);
create index idx_profiles_department   on profiles(department_id);
create index idx_requests_status       on requests(status);
create index idx_requests_requester    on requests(requester_id);
create index idx_requests_department   on requests(department_id);
create index idx_requests_type         on requests(type);
create index idx_approvals_request     on request_approvals(request_id);
create index idx_attachments_request   on request_attachments(request_id);
create index idx_expenses_date         on expenses(expense_date);
create index idx_expenses_department   on expenses(department_id);
create index idx_income_date           on income(received_date);
create index idx_payments_status       on payments(status);
create index idx_notifications_user    on notifications(user_id, is_read);
create index idx_audit_actor           on audit_logs(actor_id);
create index idx_audit_created         on audit_logs(created_at);
