-- =============================================================================
-- LOCAL DEVELOPMENT SEED  (runs on `supabase db reset` / `supabase start`)
-- Creates one demo login per role plus sample data for the dashboard & charts.
--
-- Workflow: Employee -> Finance Staff -> Finance Manager -> Accountant -> Completed
-- Demo password for EVERY account below:  Password123!
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Demo auth users. The on_auth_user_created trigger creates the matching
-- profile automatically from raw_user_meta_data (full_name, role, employee_no).
-- -----------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
   'admin@fagle.ph', crypt('Password123!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"Ramon Aquino","role":"administrator","employee_no":"ADM-001"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated',
   'employee@fagle.ph', crypt('Password123!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"John Rivera","role":"employee","employee_no":"EMP-001"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated',
   'finance.staff@fagle.ph', crypt('Password123!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"Paolo Mendoza","role":"finance_staff","employee_no":"FST-001"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '55555555-5555-5555-5555-555555555555', 'authenticated', 'authenticated',
   'finance.manager@fagle.ph', crypt('Password123!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"Isabel Cruz","role":"finance_manager","employee_no":"FMG-001"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '77777777-7777-7777-7777-777777777777', 'authenticated', 'authenticated',
   'accountant@fagle.ph', crypt('Password123!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"Liza Gomez","role":"accountant","employee_no":"ACC-001"}', now(), now())
on conflict (id) do nothing;

-- GoTrue scans these token columns as non-null strings; they have no default,
-- so blank them out for the demo users (NULL breaks password sign-in).
update auth.users
set confirmation_token = '',
    recovery_token = '',
    email_change_token_new = '',
    email_change = ''
where email like '%@fagle.ph';

-- Email identities so password sign-in resolves (required by recent GoTrue).
insert into auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
)
select
  u.id, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', u.id::text, now(), now(), now()
from auth.users u
where u.id in (
  '11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
  '44444444-4444-4444-4444-444444444444','55555555-5555-5555-5555-555555555555',
  '77777777-7777-7777-7777-777777777777')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Flesh out the profiles the trigger created (department, position, phone).
-- -----------------------------------------------------------------------------
update profiles set department_id = (select id from departments where code = 'EXEC'),
  position = 'System Administrator', phone = '+63 917 100 0001'
  where id = '11111111-1111-1111-1111-111111111111';
update profiles set department_id = (select id from departments where code = 'OPS'),
  position = 'Operations Associate', phone = '+63 917 100 0002'
  where id = '22222222-2222-2222-2222-222222222222';
update profiles set department_id = (select id from departments where code = 'FIN'),
  position = 'Finance Associate', phone = '+63 917 100 0004'
  where id = '44444444-4444-4444-4444-444444444444';
update profiles set department_id = (select id from departments where code = 'FIN'),
  position = 'Finance Manager', phone = '+63 917 100 0005'
  where id = '55555555-5555-5555-5555-555555555555';
update profiles set department_id = (select id from departments where code = 'FIN'),
  position = 'Senior Accountant', phone = '+63 917 100 0007'
  where id = '77777777-7777-7777-7777-777777777777';

-- The Finance Manager heads the Finance department.
update departments set manager_id = '55555555-5555-5555-5555-555555555555' where code = 'FIN';

-- -----------------------------------------------------------------------------
-- Budgets for fiscal year 2026
-- -----------------------------------------------------------------------------
insert into budgets (name, department_id, period, fiscal_year, amount, allocated, start_date, end_date, created_by)
values
  ('Operations Monthly Budget', (select id from departments where code='OPS'), 'monthly', 2026, 500000, 300000, '2026-07-01', '2026-07-31', '55555555-5555-5555-5555-555555555555'),
  ('Finance Monthly Budget', (select id from departments where code='FIN'), 'monthly', 2026, 400000, 150000, '2026-07-01', '2026-07-31', '55555555-5555-5555-5555-555555555555'),
  ('HR Monthly Budget', (select id from departments where code='HR'), 'monthly', 2026, 300000, 100000, '2026-07-01', '2026-07-31', '55555555-5555-5555-5555-555555555555'),
  ('Company Annual Budget', null, 'yearly', 2026, 12000000, 4500000, '2026-01-01', '2026-12-31', '55555555-5555-5555-5555-555555555555');

-- -----------------------------------------------------------------------------
-- Sample requests spanning every stage of the approval chain
-- -----------------------------------------------------------------------------
insert into requests (id, type, title, description, justification, requester_id, department_id, vendor_id, category_id, amount, priority, needed_by, status, created_at)
values
  ('a0000001-0000-0000-0000-000000000001', 'purchase', 'New Laptop for Operations',
   'Dell Latitude 5540, i7/16GB/512GB for daily operations work.', 'Current laptop is 6 years old and failing.',
   '22222222-2222-2222-2222-222222222222', (select id from departments where code='OPS'),
   (select id from vendors where name='TechHub Solutions Inc.'),
   (select id from categories where name='Equipment & Hardware'), 78500.00, 'high', '2026-08-10', 'pending_finance_staff', now() - interval '2 days'),

  ('a0000002-0000-0000-0000-000000000002', 'purchase', 'Annual Cloud Subscription Renewal',
   'CloudServe Digital annual plan renewal for the finance team.', 'Required to keep bookkeeping tools running.',
   '22222222-2222-2222-2222-222222222222', (select id from departments where code='OPS'),
   (select id from vendors where name='CloudServe Digital'),
   (select id from categories where name='Software & Subscriptions'), 120000.00, 'medium', '2026-08-01', 'pending_finance_manager', now() - interval '5 days'),

  ('a0000003-0000-0000-0000-000000000003', 'reimbursement', 'Client Meeting Transportation',
   'Grab and fuel expenses for on-site client visits.', 'Reimbursement for out-of-pocket travel.',
   '22222222-2222-2222-2222-222222222222', (select id from departments where code='OPS'),
   null, (select id from categories where name='Travel & Transportation'), 4350.00, 'low', null, 'pending_accountant', now() - interval '6 days'),

  ('a0000004-0000-0000-0000-000000000004', 'purchase', 'Office Supplies Restock',
   'Bond paper, ink, folders and pens for Q3.', 'Monthly office consumables replenishment.',
   '22222222-2222-2222-2222-222222222222', (select id from departments where code='OPS'),
   (select id from vendors where name='OfficeWarehouse Corp.'),
   (select id from categories where name='Office Supplies'), 15750.00, 'medium', '2026-07-30', 'pending_finance_staff', now() - interval '1 day'),

  ('a0000005-0000-0000-0000-000000000005', 'reimbursement', 'Team Training Seminar',
   'Registration for a financial analysis seminar.', 'Professional development reimbursement.',
   '22222222-2222-2222-2222-222222222222', (select id from departments where code='OPS'),
   null, (select id from categories where name='Training & Development'), 18000.00, 'medium', null, 'completed', now() - interval '12 days'),

  ('a0000006-0000-0000-0000-000000000006', 'purchase', 'Ergonomic Office Chairs (x4)',
   'Replacement ergonomic chairs for the operations floor.', 'Health and safety compliance.',
   '22222222-2222-2222-2222-222222222222', (select id from departments where code='OPS'),
   (select id from vendors where name='OfficeWarehouse Corp.'),
   (select id from categories where name='Equipment & Hardware'), 32000.00, 'low', '2026-07-05', 'completed', now() - interval '20 days'),

  ('a0000007-0000-0000-0000-000000000007', 'purchase', 'Standing Desk Request',
   'Adjustable standing desk.', 'Ergonomic request.',
   '22222222-2222-2222-2222-222222222222', (select id from departments where code='OPS'),
   (select id from vendors where name='OfficeWarehouse Corp.'),
   (select id from categories where name='Equipment & Hardware'), 22000.00, 'low', '2026-08-15', 'returned', now() - interval '3 days');

-- Approval history for the requests
insert into request_approvals (request_id, actor_id, action, role_at_action, from_status, to_status, remarks, created_at) values
  ('a0000001-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'submitted', 'employee', 'draft', 'pending_finance_staff', 'Submitted for review.', now() - interval '2 days'),

  ('a0000002-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'submitted', 'employee', 'draft', 'pending_finance_staff', 'Submitted.', now() - interval '5 days'),
  ('a0000002-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 'validated', 'finance_staff', 'pending_finance_staff', 'pending_finance_manager', 'Documents verified, within budget.', now() - interval '4 days'),

  ('a0000003-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'submitted', 'employee', 'draft', 'pending_finance_staff', 'Submitted.', now() - interval '6 days'),
  ('a0000003-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444', 'validated', 'finance_staff', 'pending_finance_staff', 'pending_finance_manager', 'Receipts verified.', now() - interval '5 days'),
  ('a0000003-0000-0000-0000-000000000003', '55555555-5555-5555-5555-555555555555', 'final_approved', 'finance_manager', 'pending_finance_manager', 'pending_accountant', 'Approved for payment.', now() - interval '4 days'),

  ('a0000004-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'submitted', 'employee', 'draft', 'pending_finance_staff', 'Submitted.', now() - interval '1 day'),

  ('a0000005-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'submitted', 'employee', 'draft', 'pending_finance_staff', 'Submitted.', now() - interval '12 days'),
  ('a0000005-0000-0000-0000-000000000005', '44444444-4444-4444-4444-444444444444', 'validated', 'finance_staff', 'pending_finance_staff', 'pending_finance_manager', 'Verified.', now() - interval '11 days'),
  ('a0000005-0000-0000-0000-000000000005', '55555555-5555-5555-5555-555555555555', 'final_approved', 'finance_manager', 'pending_finance_manager', 'pending_accountant', 'Approved.', now() - interval '10 days'),
  ('a0000005-0000-0000-0000-000000000005', '77777777-7777-7777-7777-777777777777', 'completed', 'accountant', 'pending_accountant', 'completed', 'Paid via GCash and recorded.', now() - interval '9 days'),

  ('a0000006-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'submitted', 'employee', 'draft', 'pending_finance_staff', 'Submitted.', now() - interval '20 days'),
  ('a0000006-0000-0000-0000-000000000006', '44444444-4444-4444-4444-444444444444', 'validated', 'finance_staff', 'pending_finance_staff', 'pending_finance_manager', 'Budget available.', now() - interval '18 days'),
  ('a0000006-0000-0000-0000-000000000006', '55555555-5555-5555-5555-555555555555', 'final_approved', 'finance_manager', 'pending_finance_manager', 'pending_accountant', 'Approved.', now() - interval '15 days'),
  ('a0000006-0000-0000-0000-000000000006', '77777777-7777-7777-7777-777777777777', 'completed', 'accountant', 'pending_accountant', 'completed', 'Paid via bank transfer and recorded to ledger.', now() - interval '13 days'),

  ('a0000007-0000-0000-0000-000000000007', '22222222-2222-2222-2222-222222222222', 'submitted', 'employee', 'draft', 'pending_finance_staff', 'Submitted.', now() - interval '3 days'),
  ('a0000007-0000-0000-0000-000000000007', '44444444-4444-4444-4444-444444444444', 'returned', 'finance_staff', 'pending_finance_staff', 'returned', 'Please attach a supplier quotation.', now() - interval '2 days');

-- -----------------------------------------------------------------------------
-- Ledger: payments + expense + journal for the completed requests (#5, #6)
-- -----------------------------------------------------------------------------
insert into payments (request_id, amount, method, reference_number, account_id, status, scheduled_date, paid_at, processed_by)
values ('a0000006-0000-0000-0000-000000000006', 32000.00, 'bank_transfer', 'BDO-TRX-559012',
        (select id from accounts where name='BDO Corporate Checking'), 'paid', now()::date - 13, now() - interval '13 days',
        '77777777-7777-7777-7777-777777777777');

insert into payments (request_id, amount, method, reference_number, account_id, status, scheduled_date, paid_at, processed_by)
values ('a0000005-0000-0000-0000-000000000005', 18000.00, 'gcash', 'GC-778120',
        (select id from accounts where name='BPI Payroll Account'), 'paid', now()::date - 9, now() - interval '9 days',
        '77777777-7777-7777-7777-777777777777');

insert into expenses (request_id, description, category_id, account_id, department_id, budget_id, vendor_id, amount, expense_date, payment_status, recorded_by)
values ('a0000006-0000-0000-0000-000000000006', 'Ergonomic office chairs (x4)',
        (select id from categories where name='Equipment & Hardware'),
        (select id from accounts where name='BDO Corporate Checking'),
        (select id from departments where code='OPS'),
        (select id from budgets where name='Operations Monthly Budget'),
        (select id from vendors where name='OfficeWarehouse Corp.'),
        32000.00, now()::date - 13, 'paid', '77777777-7777-7777-7777-777777777777');

-- -----------------------------------------------------------------------------
-- Monthly income & expenses for the dashboard charts (Jan–Jul 2026)
-- -----------------------------------------------------------------------------
insert into income (source, description, category_id, account_id, department_id, amount, received_date, recorded_by)
select
  'Consulting revenue — ' || to_char(d, 'Mon YYYY'),
  'Monthly consulting and advisory income.',
  (select id from categories where name='Consulting Fees'),
  (select id from accounts where name='BDO Corporate Checking'),
  (select id from departments where code='FIN'),
  380000 + (random() * 220000)::int,
  d,
  '77777777-7777-7777-7777-777777777777'
from generate_series(date '2026-01-01', date '2026-07-01', interval '1 month') d;

insert into income (source, description, category_id, account_id, department_id, amount, received_date, recorded_by)
select
  'Tax prep & payroll — ' || to_char(d, 'Mon YYYY'),
  'Monthly tax preparation and payroll processing income.',
  (select id from categories where name='Tax Preparation'),
  (select id from accounts where name='BDO Corporate Checking'),
  (select id from departments where code='FIN'),
  120000 + (random() * 90000)::int,
  d,
  '77777777-7777-7777-7777-777777777777'
from generate_series(date '2026-01-01', date '2026-07-01', interval '1 month') d;

insert into expenses (description, category_id, account_id, department_id, vendor_id, amount, expense_date, payment_status, recorded_by)
select
  'Operating expenses — ' || to_char(d, 'Mon YYYY'),
  (select id from categories where name='Utilities'),
  (select id from accounts where name='BDO Corporate Checking'),
  (select id from departments where code='OPS'),
  null,
  180000 + (random() * 120000)::int,
  d,
  'paid',
  '77777777-7777-7777-7777-777777777777'
from generate_series(date '2026-01-01', date '2026-07-01', interval '1 month') d;

insert into expenses (description, category_id, account_id, department_id, vendor_id, amount, expense_date, payment_status, recorded_by)
select
  'Payroll & professional fees — ' || to_char(d, 'Mon YYYY'),
  (select id from categories where name='Professional Fees'),
  (select id from accounts where name='BPI Payroll Account'),
  (select id from departments where code='HR'),
  null,
  150000 + (random() * 80000)::int,
  d,
  'paid',
  '77777777-7777-7777-7777-777777777777'
from generate_series(date '2026-01-01', date '2026-07-01', interval '1 month') d;

-- Journal entry for the completed request
insert into journal_entries (description, entry_date, request_id, debit_account_id, credit_account_id, amount, period, posted_by)
values ('Purchase of ergonomic office chairs (x4)', now()::date - 13, 'a0000006-0000-0000-0000-000000000006',
        (select id from accounts where name='Operating Expenses'),
        (select id from accounts where name='BDO Corporate Checking'),
        32000.00, '2026-07', '77777777-7777-7777-7777-777777777777');

-- -----------------------------------------------------------------------------
-- Notifications (pending action per reviewer) and a few audit log entries
-- -----------------------------------------------------------------------------
insert into notifications (user_id, title, body, type, link, request_id) values
  ('44444444-4444-4444-4444-444444444444', 'New request submitted', 'John Rivera submitted "New Laptop for Operations".', 'approval', '/approvals', 'a0000001-0000-0000-0000-000000000001'),
  ('44444444-4444-4444-4444-444444444444', 'New request submitted', 'John Rivera submitted "Office Supplies Restock".', 'approval', '/approvals', 'a0000004-0000-0000-0000-000000000004'),
  ('55555555-5555-5555-5555-555555555555', 'Request awaiting final approval', '"Annual Cloud Subscription Renewal" is ready for your approval.', 'approval', '/approvals', 'a0000002-0000-0000-0000-000000000002'),
  ('77777777-7777-7777-7777-777777777777', 'Request ready for payment', '"Client Meeting Transportation" was approved and needs payment & recording.', 'payment', '/approvals', 'a0000003-0000-0000-0000-000000000003'),
  ('22222222-2222-2222-2222-222222222222', 'Your request was returned', '"Standing Desk Request" needs a supplier quotation.', 'rejection', '/purchase-requests', 'a0000007-0000-0000-0000-000000000007');

insert into audit_logs (actor_id, action, entity_type, entity_id, description) values
  ('22222222-2222-2222-2222-222222222222', 'created', 'requests', 'a0000001-0000-0000-0000-000000000001', 'Created purchase request PR — New Laptop for Operations'),
  ('44444444-4444-4444-4444-444444444444', 'validated', 'requests', 'a0000002-0000-0000-0000-000000000002', 'Validated request and forwarded to Finance Manager'),
  ('55555555-5555-5555-5555-555555555555', 'final_approved', 'requests', 'a0000003-0000-0000-0000-000000000003', 'Final-approved request and forwarded to Accountant'),
  ('77777777-7777-7777-7777-777777777777', 'completed', 'requests', 'a0000006-0000-0000-0000-000000000006', 'Paid and recorded completed transaction to ledger'),
  ('11111111-1111-1111-1111-111111111111', 'login', 'auth', null, 'Administrator signed in');
