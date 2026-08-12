# Claude Guide — POS Migration into HRMS/JMAC

## Purpose

This file is the working guide for migrating the standalone POS into the HRMS/JMAC enterprise system.

This is **not** a rebuild from zero.
This is a controlled migration/integration.

The standalone POS should be used as the reference implementation for POS behavior, business rules, UI patterns, RPC logic, inventory logic, and checkout safety.

The HRMS/JMAC system remains the main enterprise system and source of truth for users, employees, roles, permissions, branches, audit logs, and eventually FMS integration.

---

## Non-Negotiable Rules

Do not commit or push.

Do not reset the database.

Do not wipe data.

Do not weaken RLS.

Do not expose service role keys in the frontend.

Do not copy standalone POS auth blindly into HRMS.

Do not create a separate POS login page.

Do not create a separate FMS login page.

Use the HRMS/JMAC login page as the only login page for HRMS, POS, Employee Self-Service, and future FMS users.

Do not duplicate HRMS employee/staff management if HRMS already owns it.

Do not build full FMS inside POS.

Do not build supplier, purchase order, supplier invoice, or accounts payable workflows inside POS.

Do not let restock requests, product requests, or approvals automatically increase stock.

Stock increases only when stock is actually received through a controlled receiving/restock operation.

COGS is recorded only when products are sold, not when products are restocked.

---

## Architecture Decision

HRMS/JMAC is the parent enterprise system.

POS becomes one portal/module inside HRMS/JMAC.

The final system should have separate portals/layouts:

```text
HRMS/Admin Portal      → /dashboard/*
POS Portal             → /pos/*
Employee Self-Service  → /employee/*
Future FMS Portal      → /fms/* or /finance/* depending on existing route style
```

## Unified Login Decision

Use the existing HRMS/JMAC login page as the single login page for all users and all portals.

There must not be separate login pages for POS or FMS.

Target login rule:

```text
All users log in through the HRMS/JMAC login page.
After successful login, route the user to the correct portal based on current HRMS/JMAC roles and permissions.
```

This applies to:

```text
HRMS/Admin users
POS cashiers/managers/admins
Employee self-service users
Future FMS/Finance users
Multi-portal users
```

Do not migrate or preserve standalone POS login as a separate authentication system.
Do not create separate FMS login.
Do not duplicate user accounts between HRMS, POS, and FMS.

HRMS/JMAC auth must be the source of truth for:

```text
login credentials
user identity
employee link
roles
permissions
branch/store assignment
portal access
account active/deactivated status
```

After login, derive the landing portal from the current logged-in user, not from the previous URL or previous user session.

Suggested landing logic:

```text
Cashier only      → /pos
Employee only     → /employee
FMS/Finance only  → /fms or /finance depending on existing route style
Admin/HR          → /dashboard
Multi-portal user → default portal by priority or show portal switcher
```

Logout must clear route/session-specific UI state so the next user never inherits the previous user's portal.

---

One person should have one login account, but that account may have access to multiple portals depending on role and permissions.

Examples:

```text
Cashier only      → lands on POS portal
Employee only     → lands on Employee Self-Service portal
Admin/HR          → lands on HRMS/Admin portal
Admin with POS    → can access HRMS/Admin and POS modules
Cashier employee  → can switch between POS and Employee Self-Service, but must not see HRMS employee management
```

Previous-user route state must never decide the next user's portal after logout/login.

---

## What POS Owns

POS should own operational selling and inventory activity:

```text
Products for selling
Categories
Inventory quantity
Inventory movements
Checkout/till
Sales
Sale items
Receipts
Cashier transactions
Payment method capture
Manual payment references
Basic POS reports
Cashier shift/cash drawer if implemented
Stock request creation
Product request creation
```

---

## What HRMS Owns

HRMS/JMAC should own people and access:

```text
Users/accounts
Employees
Roles
Permissions
Branches
Departments
Work locations
Audit framework
Portal routing
Employee self-service
```

Do not migrate standalone POS Staff Management as a separate identity system if HRMS already has users/employees/roles.

Do not migrate standalone POS login/register as a separate auth system.

Instead, map POS and future FMS access to existing HRMS users, employees, branches, and permissions.

---

## What FMS Owns Later

FMS should own financial purchasing and accounting:

```text
Suppliers
Purchase requests approval
Purchase orders
Supplier bills/invoices
Supplier payments
Accounts payable
Inventory purchase cost
Cash/bank outflow for restocking
Financial journal entries
Expenses
PayMongo fees and payment reconciliation if designed there
```

POS may create or surface requests, but FMS should approve and financially process them.

---

## Core Integration Boundary

The flow should be:

```text
POS sells product
→ POS deducts stock
→ POS records sale and sale items
→ POS records COGS based on cost snapshot
→ Finance/FMS receives journal-ready sales data
```

For restocking:

```text
Manager notices low stock
→ Manager creates Stock Request in POS/Inventory Requests
→ FMS/Admin reviews
→ FMS handles supplier purchase
→ Stock is received
→ POS inventory increases through controlled movement
```

For new products:

```text
Manager proposes new product
→ Admin/FMS reviews
→ Product request approved or rejected
→ Approved product is created but not automatically sellable unless rules allow
→ Initial stock request/purchase happens
→ Stock received
→ Product becomes active/sellable
```

---

## Migration Strategy

This migration must be done in phases.

Do not copy everything at once.

Do not mix unrelated modules in one large edit.

Each phase must end with tests and a short handoff note.

Recommended order:

```text
Phase 0  — Baseline audit and mapping
Phase 1  — Portal/routing architecture
Phase 2  — POS schema design inside HRMS
Phase 3  — Products and categories
Phase 4  — Inventory and stock movements
Phase 5  — Till/checkout and trusted server-side pricing
Phase 6  — Transactions and receipts
Phase 7  — Reports and role-based visibility
Phase 8  — Inventory Requests: stock and new product requests
Phase 9  — Payment QR / PayMongo QRPh preparation
Phase 10 — Cashier shift/cash drawer, if approved
Phase 11 — FMS bridge points
Phase 12 — Full E2E and security review
```

---

# Phase 0 — Baseline Audit and Mapping

Before editing, inspect both systems.

In standalone POS, inspect:

```text
package.json
src/pages
src/components
src/lib
src/services
src/hooks
supabase/migrations
supabase/functions
supabase/config.toml
scripts
README.md
```

In HRMS/JMAC, inspect:

```text
package.json
src/routes or router files
src/components/layout
src/lib/auth
src/lib/permissions
src/pages or src/features
src/services
src/types
src/integrations/supabase
src/navigation
src/test or tests
supabase/db/migrations or db/migrations
```

Search for:

```text
POS
Sales
Inventory
Products
Categories
Transactions
permissions
roles
portal
navigation
employees
branches
audit_logs
finance_journal_entries
```

Output before editing:

```text
1. Current HRMS route structure
2. Current HRMS permission model
3. Current HRMS employee/user model
4. Current standalone POS modules
5. POS tables/RPCs/functions that can be reused conceptually
6. POS tables/RPCs/functions that must NOT be copied directly
7. Proposed target HRMS POS route structure
8. Proposed migration phases for the current codebase
```

---

# Phase 1 — Portal, Routing, and Unified Login Architecture

Use the HRMS/JMAC login page as the only login page.

Remove, disable, or do not migrate standalone POS login/register pages.

Login flow must be:

```text
User opens HRMS/JMAC login
→ authenticates through HRMS/JMAC auth
→ app loads current user's roles/permissions/employee/branch data
→ app redirects to the correct portal
```

Target POS routes should use the HRMS/JMAC route style, but preferably:

```text
/pos
/pos/till
/pos/products
/pos/categories
/pos/inventory
/pos/transactions
/pos/my-transactions
/pos/reports
/pos/payment-qr
/pos/additional-fees
/pos/inventory-requests
```

Do not put cashier POS inside HRMS employee management.

Do not make cashier see HRMS modules.

Do not make Employee Self-Service show POS modules.

Admin may have access to POS modules depending on current product decision, but route ownership must be clear.

Required behavior:

```text
Cashier logs in → POS portal
Admin logs in → HRMS/Admin portal, with access to POS if permitted
Employee logs in → Employee portal
Multi-portal user → portal switcher or account menu switcher
Logout clears route/session-specific UI state
Next login derives portal from current user, not previous URL
```

Tests to add or update:

```text
only HRMS/JMAC login page is used for HRMS/POS/FMS users
standalone POS login/register routes are removed, redirected, or blocked
cashier login through HRMS login lands on /pos
FMS/Finance user login through HRMS login lands on /fms or /finance when implemented
admin can access POS if permitted
cashier cannot access /dashboard/employees
employee-only user cannot access /pos
admin logout from /pos then HR staff login does not inherit POS route
previous-user route state does not decide the next user's portal
```

---

# Phase 2 — Schema Design Inside HRMS

Do not blindly import standalone POS migrations.

Design HRMS-compatible tables or adapt existing ones.

Expected POS tables may include:

```text
pos_products
pos_categories
pos_inventory_movements
pos_sales
pos_sale_items
pos_payment_sessions
pos_additional_fees
pos_receipts
pos_cashier_shifts
pos_inventory_requests
pos_inventory_request_items
```

Use actual naming style already present in HRMS/JMAC.

If HRMS already has tables with equivalent purpose, evaluate whether to extend them instead of creating duplicates.

Important design requirements:

```text
Every POS record must be scoped to branch/store if the system is branch-based.
Every POS sale must have created_by / cashier_id.
Every inventory movement must reference product, quantity, reason, actor, and source.
Every sale item must store selling price snapshot and cost snapshot.
Historical sale data must not change when product price/cost changes later.
```

Forward-only migrations only.

No destructive migrations unless explicitly approved.

---

# Phase 3 — Products and Categories

Use the standalone POS product/category rules as reference.

Required behavior:

```text
Products have category, selling price, cost/capital, barcode/SKU if used, active/archive status, stock quantity, and low-stock threshold.
Categories are store/branch scoped if the business requires it.
Duplicate products/categories should be prevented where appropriate.
Archived products should not appear in POS checkout.
Cashier should not create/edit/archive products unless explicitly permitted.
```

Manager product creation decision:

Managers should not directly create sellable products unless explicitly allowed.

Preferred process:

```text
Manager submits New Product Request
→ Admin/FMS reviews
→ Approved request creates product record
→ Product remains pending stock or inactive until stock is received
→ Product becomes sellable only when active/approved and available
```

Do not let product approval automatically increase inventory.

---

# Phase 4 — Inventory and Stock Movements

Inventory quantity must be controlled.

Do not allow direct unsafe stock edits.

All quantity changes should produce inventory movement records.

Movement examples:

```text
sale
restock_received
adjustment_in
adjustment_out
void_reversal
refund_return
stock_count_correction
```

Restocking logic:

```text
Restock request submitted → no stock change
Restock request approved → no stock change
Supplier purchase created in FMS → no stock change in POS yet
Stock received → inventory increases and movement is recorded
```

COGS logic:

```text
Restocking does not create COGS.
COGS is created only when products are sold.
Sale item cost snapshots become COGS.
```

---

# Phase 5 — Till / Checkout

Checkout must use trusted server-side pricing.

Frontend cart must not be trusted for price, cost, fees, or profit.

Frontend should send only safe checkout data such as:

```text
product_id
quantity
payment method
manual reference if applicable
checkout idempotency key
```

Server/RPC/Edge Function should compute:

```text
current selling price
cost snapshot
fees
subtotal
total
gross sales
net sales
COGS
gross profit
net profit when applicable
stock deduction
sale record
sale item records
inventory movements
journal-ready finance data
```

Idempotency is required.

Double-clicking checkout must not create duplicate sales or deduct stock twice.

Stock must be checked atomically.

Underpayment must be rejected.

Cashier response must not expose profit/COGS if product rule says cashier should not see it.

---

# Phase 6 — Transactions and Receipts

Required transaction visibility:

```text
Admin/Manager with permission → can view store/branch transactions
Cashier → can view only own transactions
Cashier → must not see other cashiers' transactions
Cashier → must not see profit/COGS unless explicitly permitted
```

Transaction features:

```text
transaction list
my transactions
sale details
receipt view/reprint
date filter
payment method filter
cashier filter for admin/manager
status filter
```

Sale records should not be hard deleted.

Use statuses such as:

```text
completed
voided
refunded
partially_refunded
```

---

# Phase 7 — Reports and Accounting Logic

Reports should separate:

```text
Gross Sales
Net Sales
COGS
Gross Profit
Net Profit
Transaction count
Average sale
Payment method totals
Top products
Low stock
Inventory value
Stock movements
Cashier performance if allowed
```

Definitions:

```text
Gross Sales = total sales before sales deductions
Net Sales = gross sales minus discounts/returns/refunds/sales deductions
COGS = cost of products actually sold
Gross Profit = Net Sales - COGS
Net Profit = Gross Profit - operating expenses/payment fees/other deductions
```

Restocking purchase cost is not COGS immediately.

Restocking purchase belongs to FMS as inventory purchase/cash outflow/accounts payable.

Only sold items become COGS.

Cashier should not see profit, COGS, or sensitive margin reports unless explicitly permitted.

---

# Phase 8 — Inventory Requests Module

Build or plan an Inventory Requests module as the bridge between POS and FMS.

This module should support two request types:

```text
1. Restock Request
2. New Product Request
```

## Restock Request Process

```text
Manager selects existing product
→ enters requested quantity
→ enters reason/notes
→ submits request
→ Admin/FMS reviews
→ request approved/rejected/changes requested
→ FMS handles supplier purchase later
→ stock increases only when received
```

## New Product Request Process

```text
Manager enters proposed product details
→ category
→ suggested selling price
→ suggested cost
→ unit/barcode/SKU if any
→ initial stock needed
→ reason/notes
→ submits request
→ Admin/FMS reviews
→ approved request creates product record
→ product remains not sellable or pending stock until stock is received/activated
```

## Request Statuses

Recommended statuses:

```text
draft
submitted
under_review
changes_requested
approved
rejected
cancelled
purchase_ordered
partially_received
completed
```

Rules:

```text
Request submission must not increase stock.
Approval must not increase stock.
Purchase ordered must not increase stock.
Only receiving increases stock.
Every receiving action creates an inventory movement.
Every approval/rejection/receiving action creates an audit log.
```

Do not build full supplier or purchase order workflows inside POS.

Those belong to FMS.

---

# Phase 9 — Additional Fees and Payment QR / PayMongo QRPh

The standalone POS has Additional Fees and Payment QR Code modules.

When migrating to HRMS/JMAC:

```text
Additional Fees should be an admin-controlled POS configuration module.
Payment QR / QRPh should be an admin-controlled payment configuration module.
Settings should not be a dumping ground for unrelated options.
```

## Additional Fees

Preserve fee logic:

```text
fixed fee
percentage fee
valid ranges
no negative fees
PostgreSQL-compatible rounding
checkout total matches server total
```

Do not break the fixed fee rounding behavior.

## Payment QR / PayMongo QRPh

Current static/manual QR behavior may remain as a fallback.

Future target is PayMongo QRPh for verified e-wallet/bank payments.

Target payment methods:

```text
GCash
Maya
Bank apps that support QRPh
PayMongo QRPh
```

Rules:

```text
Never put PayMongo secret key in React/frontend code.
PayMongo API calls must happen in Supabase Edge Functions or backend server code.
Frontend may display safe QR/payment data only.
Manual reference number is not proof of payment.
PayMongo payment should be marked paid only after webhook/status confirmation.
Manual QR/reference payment and verified PayMongo QRPh payment must be distinguishable.
```

Do not implement full PayMongo unless explicitly assigned.

Prepare the module and data model so PayMongo can be added later.

Possible future table:

```text
payment_sessions
- id
- sale_id nullable until sale completion
- checkout_key
- provider
- provider_payment_intent_id
- amount
- status
- method
- raw_event metadata
- created_by
- created_at
- updated_at
```

---

# Phase 10 — Cashier Shift / Cash Drawer

This is optional unless explicitly approved, but recommended for real POS.

Suggested process:

```text
Cashier starts shift
→ enters opening cash
→ sells products
→ records cash in/out if allowed
→ ends shift
→ enters actual cash count
→ system computes expected cash
→ shortage/overage is recorded
```

This module is useful before FMS integration because it helps reconcile cash sales.

Do not mix cash drawer with supplier purchasing.

---

# Phase 11 — FMS Bridge Points

Create clean integration points but do not build full FMS in POS.

POS should be able to emit or expose:

```text
sales totals
payment method totals
COGS
gross profit
inventory movements
stock received records
refund/void records
cashier shift summaries
approved inventory requests
```

FMS later consumes these to create accounting records such as:

```text
Debit Cash / Bank / Payment Clearing
Credit Sales Revenue
Debit COGS
Credit Inventory
Debit Inventory
Credit Accounts Payable / Cash for supplier purchases
Debit Payment Fees
Credit Cash / Payment Processor Clearing
```

Do not hard-code final chart of accounts yet unless FMS already has one.

---

# Phase 12 — Security Review

Review these risks before considering migration complete:

```text
Cashier cannot see profit/COGS if restricted.
Cashier cannot manage staff.
Cashier cannot change product cost.
Cashier cannot change fees.
Cashier cannot upload payment QR.
Cashier cannot view all transactions unless allowed.
Manager cannot bypass FMS approval for purchases.
Manager cannot directly make new sellable products unless allowed.
Manager cannot increase stock through request approval.
Archived/deactivated products cannot be sold.
Checkout cannot be duplicated by double-click.
Frontend prices/costs cannot be trusted.
RLS blocks foreign branch/store access.
Edge Functions do not expose secrets.
Audit logs capture sensitive actions.
```

---

# Testing Requirements

Before any migration work:

```bash
npm run build
npm run lint
npm test
```

Use only scripts that exist in the target project.

After each migration phase, run available checks again.

Minimum E2E flows required before final approval:

```text
Admin can access POS modules if permitted.
Cashier lands on POS and sees only POS modules.
Cashier cannot access HRMS employee management.
Cashier can checkout a sale.
Checkout deducts stock once.
Double-click checkout does not duplicate sale.
Cashier can view own transaction.
Cashier cannot view another cashier's transaction.
Admin/manager can view store transactions if permitted.
Product archive hides product from checkout.
Stock request submission does not change stock.
Stock request approval does not change stock.
Receiving stock changes stock and creates movement.
New product request approval does not create sellable stocked item until activated/received.
Additional fees compute correctly.
Payment QR config is admin-only.
No PayMongo secret appears in frontend bundle/source.
```

---

# Manual Browser Verification

Use real browser flows, not only unit tests.

## Admin

```text
Login as admin
Open HRMS/Admin portal
Open POS modules if permitted
View products/categories/inventory
View all transactions
Open Additional Fees
Open Payment QR / QRPh
Confirm Settings dumping page is not used for POS configuration
```

## Cashier

```text
Login as cashier
Confirm landing page is POS
Confirm HRMS modules are hidden/blocked
Open Till
Create sale
Print/view receipt
Confirm stock decreased
View own transactions
Confirm profit/COGS hidden if required
```

## Manager

```text
Login as manager
Create restock request
Create new product request
Confirm neither action changes stock immediately
Confirm approval/receiving is controlled by allowed roles
```

---

# Output Required Before Editing Each Phase

Before editing code in any phase, report:

```text
1. Phase name
2. Goal of the phase
3. Files expected to change
4. Database changes expected
5. Auth/RLS/permission impact
6. Tests to run
7. Risks
```

---

# Output Required After Editing Each Phase

After editing, report:

```text
1. Files changed
2. Routes added/changed
3. Tables/RPCs/functions added/changed
4. Permissions/RLS added/changed
5. UI behavior changed
6. Tests run and results
7. Manual checks performed
8. Known issues
9. Next recommended phase
```

Do not commit or push.

---

# Final Readiness Checklist

POS is ready to be considered migrated into HRMS/JMAC only when:

```text
The POS portal is separate from HRMS and Employee portals.
All users log in through the HRMS/JMAC login page.
There are no separate POS or FMS login pages.
Auth uses HRMS/JMAC users/roles/permissions.
Cashier access is correctly limited.
Checkout is atomic and idempotent.
Stock deductions are correct.
Inventory movements are complete.
Transactions and receipts work.
Reports are role-safe.
Additional fees work.
Payment QR / QRPh module is admin-only.
Product and stock requests are approval-based.
FMS purchasing is not duplicated inside POS.
FMS integration points are clean.
Security review passes.
Build/lint/tests pass.
Browser checkout walkthrough passes.
No database reset or data wipe was used.
```
