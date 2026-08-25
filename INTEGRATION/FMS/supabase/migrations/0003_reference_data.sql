-- =============================================================================
-- Migration 0003: Reference / master data (deterministic, part of the schema)
-- =============================================================================

-- --- Roles catalog ----------------------------------------------------------
insert into roles (key, name, description, rank, permissions) values
  ('employee', 'Employee', 'Creates purchase and reimbursement requests and tracks their status.', 1,
    '{"submit_request": true, "upload_receipt": true, "cancel_request": true, "view_own_history": true}'),
  ('finance_staff', 'Finance Staff', 'First reviewer — validates documents, checks budgets, approves or returns requests.', 2,
    '{"review_request": true, "verify_receipts": true, "check_budget": true, "approve_request": true, "return_request": true}'),
  ('finance_manager', 'Finance Manager', 'Grants final financial approval and monitors company budgets.', 3,
    '{"final_approval": true, "approve_budget": true, "review_expenses": true, "view_reports": true}'),
  ('accountant', 'Accountant', 'Processes payment, records transactions, updates the ledger and generates reports.', 4,
    '{"process_payment": true, "upload_proof": true, "record_journal": true, "update_balance": true, "generate_reports": true, "close_request": true}'),
  ('administrator', 'Administrator', 'Manages users, departments, categories, permissions and audit logs.', 5,
    '{"manage_users": true, "manage_departments": true, "manage_categories": true, "view_audit_logs": true, "manage_permissions": true}');

-- --- Departments ------------------------------------------------------------
insert into departments (name, code, description) values
  ('Finance Department', 'FIN', 'Handles accounting, budgeting and financial reporting.'),
  ('Procurement Department', 'PROC', 'Manages purchasing, vendors and quotations.'),
  ('Human Resources', 'HR', 'Manages personnel, payroll and reimbursements.'),
  ('Operations', 'OPS', 'Day-to-day business operations.'),
  ('Executive Management', 'EXEC', 'Company leadership and strategic oversight.');

-- --- Categories -------------------------------------------------------------
insert into categories (name, type, description) values
  ('Consulting Fees', 'income', 'Revenue from consulting engagements.'),
  ('Bookkeeping Services', 'income', 'Revenue from bookkeeping services.'),
  ('Payroll Processing', 'income', 'Revenue from payroll processing services.'),
  ('Tax Preparation', 'income', 'Revenue from tax preparation services.'),
  ('Advisory Services', 'income', 'Revenue from financial advisory.'),
  ('Other Income', 'income', 'Miscellaneous income.'),
  ('Office Supplies', 'expense', 'Stationery, consumables and office materials.'),
  ('Equipment & Hardware', 'expense', 'Computers, laptops and office equipment.'),
  ('Software & Subscriptions', 'expense', 'SaaS tools and software licenses.'),
  ('Travel & Transportation', 'expense', 'Business travel, fuel and transport.'),
  ('Meals & Representation', 'expense', 'Client meals and representation.'),
  ('Utilities', 'expense', 'Electricity, water, internet and phone.'),
  ('Rent & Facilities', 'expense', 'Office rent and facility costs.'),
  ('Professional Fees', 'expense', 'Legal, audit and outsourced professional fees.'),
  ('Training & Development', 'expense', 'Seminars, training and certifications.'),
  ('Miscellaneous', 'expense', 'Other operating expenses.');

-- --- Chart of accounts ------------------------------------------------------
insert into accounts (name, account_type, account_number, balance, currency) values
  ('BDO Corporate Checking', 'bank', '0012-3456-7890', 2500000.00, 'PHP'),
  ('BPI Payroll Account', 'bank', '3345-6677-8899', 850000.00, 'PHP'),
  ('Petty Cash Fund', 'asset', 'PC-001', 50000.00, 'PHP'),
  ('Operating Revenue', 'revenue', '4000', 0.00, 'PHP'),
  ('Operating Expenses', 'expense', '5000', 0.00, 'PHP');

-- --- Vendors ----------------------------------------------------------------
insert into vendors (name, contact_person, email, phone, address, tin) values
  ('TechHub Solutions Inc.', 'Maria Santos', 'sales@techhub.ph', '+63 2 8123 4567', 'Makati City, Metro Manila', '123-456-789-000'),
  ('OfficeWarehouse Corp.', 'Juan Dela Cruz', 'orders@officewarehouse.ph', '+63 2 8987 6543', 'Quezon City, Metro Manila', '234-567-890-000'),
  ('CloudServe Digital', 'Ana Reyes', 'billing@cloudserve.ph', '+63 2 8555 0100', 'Taguig City, Metro Manila', '345-678-901-000'),
  ('Prime Travel Agency', 'Carlos Lim', 'bookings@primetravel.ph', '+63 2 8222 3344', 'Pasig City, Metro Manila', '456-789-012-000');
