# AI_HANDOFF.md — Current implementation handoff

**Workspace:** `C:\Projects\JMAC\INTEGRATION`
**Application under development:** `INTEGRATION/HRMS` (npm package `harmony-suite`)
**Last updated:** 2026-08-25, after Phase 7C
**Updated by:** Codex, from the filesystem, migrations, automated checks, browser
verification, and the live local database.

Read this file first. Then `ARCHITECTURE.md` for the technical model, and
`AI_WORKFLOW.md` for how to work here. `POS_TO_HRMS_MIGRATION_CLAUDE(1).md` is
the phase-by-phase ledger.

> **A previous `AI_HANDOFF.md` in this folder described a different repository**
> (`C:\Projects\JMAC Enterprise`, package `jmac`) and claimed POS work that does
> not exist here. It has been moved to
> `AI_HANDOFF_LEGACY_JMAC_ENTERPRISE.md`. Do not treat it as a record of this
> workspace: its authorization model, its file layout (`src/features/`,
> `src/services/`), and its test counts are all from the other project. It is
> kept only because its POS slice sequencing is mildly interesting history.

---

## 1. Quick start

```bash
cd C:\Projects\JMAC\INTEGRATION\HRMS
npm install
npx supabase start          # local stack "harmony-suite" (API :55321, DB :55322)
npm run dev                 # http://localhost:5173
```

```bash
npm test                    # vitest
npm run build               # tsc -b && vite build
npm run lint                # oxlint
```

Database contract tests (one transaction each, rolled back — they write nothing):

```bash
docker exec -i supabase_db_harmony-suite psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -f - < supabase/tests/pos_reports_rls.sql
```

Credentials for the demo accounts are in `HRMS/DEMO.md`. They are deliberately
not repeated in any of these handoff documents.

---

## 2. What this system is

**Harmony Suite / JMAC is the main parent enterprise system.** It has three
subsystems:

```text
Harmony Suite / JMAC   (parent)
├── HRMS   — built, in production shape
├── POS    — being integrated; Phases 0–7C complete
└── FMS    — not started
```

POS and FMS are **not** independent enterprise authentication systems. The
integrated target is one enterprise identity, one authentication system, one
`profiles`/`employees` source of truth, with POS and FMS as subsystems inside it.

### The two folders that are NOT the application

```text
INTEGRATION/POS   READ-ONLY REFERENCE  (the standalone SariSwift POS)
INTEGRATION/FMS   READ-ONLY REFERENCE
```

Read them freely to understand behaviour being ported. **Do not modify them**
unless the user explicitly says so. `INTEGRATION/HRMS` is the only application
tree you edit.

---

## 3. Status: what is complete

| Phase | Scope | State |
|---|---|---|
| 0 | Audit / discovery | **DONE** |
| 1 | Portal, routing, unified login | **DONE** |
| 2A | POS access assignment admin | **DONE** |
| 2B | Branch POS settings, fees, payment QR | **DONE** |
| 2C | Assignment actor hardening (`created_by`) | **DONE** |
| 3 | Products + categories | **DONE** |
| 4 | Inventory + stock movements | **DONE** |
| 5 | Till + atomic checkout + core sales | **DONE** |
| 6 | Transactions + receipt reprints + navigation revision | **DONE** |
| 7A | POS Manager dashboard + read-only manager Categories | **DONE** |
| 7B | POS Reports — Manager operational, Administrator financial | **DONE** |
| 7C | POS operational audit logs + the TRUNCATE security hotfix | **DONE** |
| — | **No approved next phase.** Candidates below need scoping and approval. | **NEXT** |
| — | Inventory requests, cashier shifts, PayMongo, FMS bridge, refund/void/return, final E2E security review | future |

---

## 4. Identity and authorization

HRMS/JMAC owns Supabase Auth, `profiles`, `employees`, roles, `branches`,
account active/deactivated state, POS assignments, enterprise permissions and
portal routing.

**Do not recreate** standalone POS auth, `stores`, `store_memberships`, separate
POS users, or separate FMS users. None of them exist in this backend.

```text
public.user_role  (profiles.role)   admin · hr_manager · hr_staff · employee
public.pos_role   (branch-scoped)   manager · cashier
```

POS access comes from `pos_branch_assignments (profile_id, branch_id, pos_role,
status, created_by, …)`. Administrators hold **no** POS assignment — their
authority comes from `profiles.role = 'admin'`.

The client reads assignments through `my_pos_assignments()`, which returns
`(branch_id, pos_role)` pairs for active assignments on active profiles. It
returns pairs, never a global "is a manager" boolean, because a single account
can be a manager at one branch and a cashier at another.

### The multi-branch rule

```text
User X:  Branch A → manager
         Branch B → cashier
```

Manager authority at A **must not** leak to B. Client helpers in
`src/lib/portals.ts`:

```text
roleForBranch(pos, branchId)      the role held at one branch
isPosManagerAt(pos, branchId)     manager at THIS branch
managerBranchIds(pos)             branches managed — the only valid picker source
cashierBranchIds(pos)             branches worked as a cashier
hasAnyManagerAssignment(pos)      manager ANYWHERE
```

`hasAnyManagerAssignment()` is only for non-branch-specific UX — landing and
navigation. Every branch operation evaluates the branch-specific role, and the
database re-decides on every call regardless of what the client believes.

---

## 5. Portal / workspace architecture

### Administrator — one workspace, no switcher

Administrators live entirely in `DashboardLayout` at `/dashboard/*`. There is
**no workspace switcher**: `portalsFor()` returns `['admin']` for
`role === 'admin'` *before* it looks at POS assignments, so a stray assignment
cannot reactivate one. `/pos/*` carries `blockRoles={['admin']}` and redirects
them to `/dashboard`.

They still run a till — at `/dashboard/admin/pos`, which mounts the **same**
`PosTillPage` component inside `DashboardLayout`. There is one checkout
implementation; only the chrome differs.

Admin sidebar has the HR modules plus a **POS MANAGEMENT** group:

```text
POS · POS Access · Products · Categories · Inventory · Transactions · POS Reports · POS Settings
```

The group now ends with **POS Audit Logs** (`/dashboard/admin/pos-audit-logs`).

**Do not restore the old workspace-switching model.**

### POS Manager — `/pos/*`

```text
Dashboard · POS · Inventory · Categories · Transactions · Reports · Audit Logs
```

Manager **Audit Logs** is the POS *operational* audit at `/pos/audit-logs` —
branch configuration and catalogue changes at branches they manage. It is not,
and must never become, the enterprise HRMS `audit_logs`. Manager Categories is
**read-only**. The offer/pause control
lives inside Inventory, not a separate Catalogue module (`/pos/catalogue` is
retired and redirects to `/pos/stock`).

### Cashier — `/pos/*`

Sidebar is exactly:

```text
POS · Transactions
```

Landing is `/pos` → `/pos/till`. Cashier Transactions means
`cashier_id = auth.uid()`, enforced in the database — `get_my_transactions()`
takes no cashier argument, so "show me someone else's" cannot be expressed. Two
cashiers at the same branch do **not** share history.

---

## 6. Current routes (from `src/App.tsx`)

**`PosLayout`** — `requirePos`, `blockRoles={['admin']}`:

```text
/pos                index → PosIndexRedirect
                      manager anywhere → /pos/dashboard
                      otherwise        → /pos/till
/pos/dashboard      PosDashboardPage     manager
/pos/till           PosTillPage          cashier + manager
/pos/stock          PosStockPage         manager (cashiers get an explainer)
/pos/categories     PosCategoriesPage    manager, read-only
/pos/transactions   PosTransactionsPage  own sales; manager also gets a Branch tab
/pos/reports        PosReportsPage       manager
/pos/audit-logs     PosAuditLogsPage     manager, POS-operational audit
/pos/catalogue      → /pos/stock         retired, redirect kept for old links
```

**`DashboardLayout`** — role-gated per route:

```text
/dashboard                        DashboardHome
/dashboard/admin/pos              PosTillPage (the SAME component)
/dashboard/admin/pos-access       PosAccessPage
/dashboard/admin/pos-products     PosProductsPage
/dashboard/admin/pos-categories   admin PosCategoriesPage (full CRUD)
/dashboard/admin/pos-inventory    PosInventoryPage
/dashboard/admin/pos-transactions admin PosTransactionsPage
/dashboard/admin/pos-reports      AdminPosReportsPage
/dashboard/admin/pos-audit-logs   AdminPosAuditLogsPage
/dashboard/admin/pos-settings     PosSettingsPage
```

Plus ~25 HR routes and the employee self-service routes. Public routes and
`/login`, `/auth/setup-password`, `/home` sit outside both layouts.

`/home` exists because the login form cannot decide the landing portal: at the
moment the password is accepted, the profile and POS queries have not resolved.

`PORTALS.pos.path` is **`/pos`**, not a specific screen — the index route is the
single place the till-vs-dashboard decision is made.

---

## 7. Database model (POS)

```text
pos_product_categories   GLOBAL enterprise taxonomy      RLS: is_admin() only
pos_products             enterprise product master       RLS: is_admin()
pos_branch_products      branch availability + price override
pos_branch_inventory     quantity_on_hand, low_stock_threshold, average_unit_cost
pos_inventory_movements  the ledger
pos_sales / pos_sale_items   snapshots; carry cost, Administrator-only
pos_branch_assignments   (profile_id, branch_id, pos_role, status)
```

There is **no stock column on `pos_products`**. There is no SKU/barcode — the
standalone had none and no requirement introduced one. The `General` category is
structural seed data and is protected by `protect_general_pos_category`.

Inventory rows are created **at zero** when a branch starts carrying a product
(trigger `trg_create_branch_inventory`). Stock changes only through
`receive_pos_stock()`, `adjust_pos_stock()` (both Administrator-only) and
checkout; `guard_pos_inventory_write` refuses direct DML on the balance.
`set_low_stock_threshold()` is the manager's one inventory write.

Receiving updates the **branch** weighted-average cost. It must never write
`pos_products.default_unit_cost`.

### Checkout (Phase 5)

The frontend sends only `branch_id`, `{product_id, quantity}[]`, payment method,
payment reference, amount tendered and a `checkout_key`. The database derives
the actor from `auth.uid()`, the authoritative selling price, fees, subtotal,
total, branch average cost, COGS snapshots, the inventory deduction and the
movement provenance. It is atomic: no partial sale, sale item, deduction or
movement can survive a failure.

Idempotency is three layers: `pg_advisory_xact_lock` + `UNIQUE (branch_id,
cashier_id, checkout_key)` + an existing-sale lookup, with a SHA-256
`request_fingerprint` computed **inside PostgreSQL** over the canonical
normalized request. Same key + same request returns the original sale; same key
+ different request is rejected. Duplicate cart lines are normalized before
locking, and inventory rows are locked in deterministic product order.

### Transactions and receipts (Phase 6)

```text
get_my_transactions(_from, _to, _limit, _offset)
    the caller's OWN sales — no cashier parameter exists

get_branch_transactions(_branch_id, _from, _to, _limit, _offset)
    has_pos_role(branch, ['manager']) — per branch

get_admin_transactions(_branch_id, _from, _to, _limit, _offset)
    is_admin()

get_sale_detail(_sale_id)
    admin OR own OR manager-at-that-branch
```

`get_sale_detail` is **IDOR-safe**: it authorizes by who is asking, and answers
a missing id and a forbidden one **identically**, so a probe learns nothing.
Knowing a `sale_id` is never enough. `pos_sale_receipt(_sale_id)` is the
internal Phase 5 helper that returns a receipt unconditionally — it is granted
to `service_role` only and is **not** executable by `authenticated` or `anon`
(verified). Keep it that way.

`pos_page_size(_requested)` clamps every list limit to 1..100.

### Dashboard (Phase 7A)

```text
pos_business_timezone()                     → 'Asia/Manila'
pos_business_date()                         → today, business calendar
pos_day_bounds(_on_date date default null)  → (business_date, day_start, day_end)

get_pos_dashboard_summary(_branch_id, _on_date default null)
get_pos_dashboard_payment_totals(_branch_id, _on_date default null)
get_pos_dashboard_top_products(_branch_id, _on_date default null, _limit default 5)
get_branch_category_summary(_branch_id)
```

All four are `SECURITY DEFINER`, `SET search_path = ''`, gated by
`has_pos_role(branch, ['manager'])`. They return **typed columns, not `jsonb`**,
on purpose: the contract test asserts "declares no cost column" against
`pg_get_function_result`, which a `jsonb` return would defeat.

Day windows are **half-open** `[start, end)` and are resolved in the database.
The client sends nothing, or a plain calendar date — never a computed timestamp
range.

### Reports (Phase 7B)

Migration `20260826020000_pos_reports.sql` added database-owned report ranges
and separate typed contracts for the two audiences:

```text
get_pos_report_presets()

get_pos_manager_report_summary(_branch_id, _date_from, _date_to)
get_pos_manager_report_trend(_branch_id, _date_from, _date_to)
get_pos_manager_report_payment_totals(_branch_id, _date_from, _date_to)
get_pos_manager_report_top_products(_branch_id, _date_from, _date_to, _limit)

get_admin_pos_report_summary(_branch_id, _date_from, _date_to)
get_admin_pos_report_trend(_branch_id, _date_from, _date_to)
get_admin_pos_report_branch_comparison(_date_from, _date_to)
```

The internal `pos_report_bounds()` helper defaults dates from
`pos_business_date()`, enforces a maximum 366-day inclusive range, and returns
half-open timestamps. Presets are also returned by PostgreSQL; the browser does
not anchor Today, Yesterday, Last 7 Days, MTD or YTD. Daily trend buckets use
the `Asia/Manila` business date through `pos_business_timezone()`.

Every sales-report query explicitly selects `status = 'completed'`.
Payment-method `amount_collected` is `SUM(total_amount)`. Top Products groups by
`product_id`, sums historical `line_total`, and displays the latest in-range
product-name snapshot. Administrator branch comparison groups by `branch_id`.

Manager report signatures and definitions are contract-tested to contain no
cost, COGS, margin, profit, or Administrator-report dependency. Administrator
reports define:

```text
Gross Product Profit   = Product Sales - COGS
Gross Product Margin % = ((Product Sales - COGS) / Product Sales) × 100
```

Gross Product Margin % is `NULL` when Product Sales is zero and the UI renders
it as `—`.

Phase 7B implementation files:

```text
supabase/migrations/20260826020000_pos_reports.sql
supabase/tests/pos_reports_rls.sql
src/lib/posReports.ts                    src/hooks/usePosReports.ts
src/components/pos/PosReportRange.tsx    src/components/pos/PosManagerRoute.tsx
src/pages/pos/PosReportsPage.tsx          src/pages/admin/AdminPosReportsPage.tsx
src/App.tsx                               src/components/layout/{PosSidebar,Sidebar}.tsx
src/hooks/usePosTill.ts                   src/lib/database.types.ts
src/lib/posReports.test.ts                src/hooks/usePosReports.test.tsx
src/pages/pos/PosReportsPage.test.tsx     src/pages/admin/AdminPosReportsPage.test.tsx
src/components/pos/PosManagerRoute.test.tsx
src/components/layout/{PosSidebar,Sidebar}.test.tsx
src/hooks/usePosTill.test.tsx
```

Phase 7B also updated this handoff, `ARCHITECTURE.md`, the migration ledger, and
root `README.md`;
`AI_WORKFLOW.md`, `INTEGRATION/POS`, and `INTEGRATION/FMS` were not changed.
Verification caught and fixed an Administrator explanatory dash that initially
rendered its Unicode escape literally. There are no unresolved Phase 7B
defects; the explicitly deferred items are recorded in §13.

---

### POS operational audit (Phase 7C)

```text
pos_audit_events   append-only; NO API role holds any privilege on it
                   RLS on, ZERO policies -- reads are RPC-only by construction

get_pos_manager_audit_events(branch, from, to, event_type, actor, entity, limit, offset)
get_admin_pos_audit_events(branch, global_only, from, to, event_type, actor, entity, limit, offset)
```

A narrow, bounded event stream for POS **configuration and catalogue** changes.
It is not a second generic enterprise audit system, and it is not a duplicate of
the domain ledgers.

**Not audited, deliberately:** ordinary checkout, ordinary stock receiving,
ordinary stock adjustment, and reads of any kind. `pos_sales`/`pos_sale_items`
and `pos_inventory_movements` already record those immutably with a trusted
actor and before/after quantities. A low-stock **threshold** change *is*
audited, because a threshold is configuration, not movement.

**Two role snapshots, not one.** POS role is branch-scoped; enterprise role is
not:

```text
actor_enterprise_role  public.user_role   admin | hr_manager | hr_staff | employee
actor_pos_role         public.pos_role    the role held AT branch_id, or null
```

An Administrator records `admin` with a null POS role. A branch manager records
`employee` / `manager`. A single conflated column could express neither, and
could not describe a Manager@A / Cashier@B account acting at B.

**Manager confidentiality is structural, not a text filter:** a constrained enum
taxonomy, an owner-only writer, physically separate `safe_*` and `admin_*`
columns, a CHECK constraint tying `manager_visible` to the taxonomy, and a
Manager RPC that projects only the safe columns and filters on `manager_visible`
in a predicate no parameter can widen. `branch_selling_price_changed` is the
single intentionally money-bearing manager-safe value — a *selling* price. A
buying-cost change is recorded as a fact, never as a number, and not even in the
administrator fields.

**No storms.** `reorder_pos_category()` rewrites every category's `sort_order`
and `delete_pos_category()` bulk-moves every product in the category. The row
triggers ignore sort-order-only changes and exclude `category_id` from the
product allowlist, and each RPC emits exactly **one** aggregate event that
records what the bulk operation did. Suppression is structural — nothing a
caller can set influences whether an event is written.

**Owner context writes nothing.** When `auth.uid()` is null — database-owner
fixture work, migrations — no event is written. Phase 7C audits people; a
fabricated "system" actor would be a lie a future FMS integration would have to
unpick.

---

## 8. The financial visibility boundary

This is the single most important rule in the integration, and the one a port
from the standalone POS is most likely to break.

```text
Cashier      never sees unit cost, average cost, COGS, margin or profit
POS Manager  never sees unit cost, average cost, COGS, margin,
             gross profit, net profit or inventory value
```

That applies to the Till, Transactions, Dashboard, Categories **and future
Manager Reports**. Manager reporting is *operational*.

```text
Administrator  financial reporting MAY expose COGS, Gross Product Profit and
               Gross Product Margin through dedicated Administrator Reports.
               Operational transaction/till responses stay receipt-safe even
               for an Administrator.
```

"Reports is where cost belongs" refers to the **Administrator's** reports. It has
never applied to a POS Manager.

The standalone POS did the opposite: `canViewProfit` was `isAdmin || isManager`,
and "Today's Net Profit" was the second card on a manager's first screen. Do not
carry that across.

The guarantee is structural, not cosmetic: no Manager-facing function declares
a cost column or depends on cost-bearing report functions, so there is nothing
on the wire to filter out in React. Contract tests assert this against both
typed result signatures and function definitions.

Money is named so it reconciles, and the names are load-bearing:

```text
Product Sales   = SUM(subtotal)
Customer Fees   = SUM(fees_total)
Sales Collected = SUM(total_amount)

Sales Collected = Product Sales + Customer Fees
```

Phase 5 deliberately does **not** persist a generic `net_profit`. Customer-paid
POS fees remain a separately reported fact until FMS settles their accounting
classification.

---

## 9. Test and database state (verified 2026-08-25)

```text
HRMS unit/component      445 tests, 31 files — passing
Build                    clean  (tsc -b && vite build)
Lint                     clean  (oxlint)
Standalone POS regression 61 tests, 9 files — passing (reference system, untouched)

Database contract suites  9 suites, 295 checks — all passing
  pos_access_rls            18
  pos_audit_logs_rls        42
  pos_branch_settings_rls   33
  pos_catalogue_rls         33
  pos_checkout_rls          36
  pos_dashboard_rls         41
  pos_inventory_rls         47
  pos_reports_rls           19
  pos_transactions_rls      26

Concurrency harnesses     scripts/pos-inventory-concurrency.sh   passing
                          scripts/pos-checkout-concurrency.sh    passing

Phase 7C browser verification   26/26 checks, Chromium, every context in
                                America/New_York — a non-Manila timezone, so a
                                browser-computed day boundary would show up
```

```text
Migrations applied: 111   (verified against supabase_migrations.schema_migrations)

Most recent:
  20260826060000_pos_audit_category_enum_cast
  20260826050000_pos_audit_product_change_fix
  20260826040000_pos_operational_audit
  20260826030000_revoke_truncate_from_api_roles   ← SECURITY HOTFIX
  20260826020000_pos_reports
  20260826010000_pos_manager_dashboard
  20260826000000_pos_business_time
```

### The TRUNCATE hotfix — what it was, and why it matters

`20260826030000` closed a live defect found during the Phase 7C review: **any
authenticated user could `TRUNCATE public.audit_logs`** and destroy the entire
enterprise audit trail. The same held for `pos_branch_assignments` — one
statement removing every POS access grant in the business. 36 tables carried the
grant.

RLS does not stop TRUNCATE. It filters rows for SELECT/INSERT/UPDATE/DELETE;
TRUNCATE is not a row operation, so PostgreSQL checks the table privilege and
consults no policy at all. A table can look perfectly locked down in
`pg_policies` and still be wipeable.

The grant came from `20260716070000`'s `grant all privileges ... on tables`,
which is correct in intent — PostgREST needs table grants before RLS is
evaluated — but "all privileges" includes TRUNCATE, and the application issues
TRUNCATE nowhere. The fix revokes it from `anon` and `authenticated` on existing
tables **and** from the default privileges, so future tables do not inherit it.
UPDATE and DELETE were deliberately left alone: RLS does govern those, and
existing HRMS modules rely on them.

This was the **sixth** instance of the default-privileges trap here.
`pos_audit_logs_rls` checks 3a–3d now assert the catalog on every run.

### Clean POS baseline

```text
pos_sales               0
pos_sale_items          0
pos_products            0
pos_product_categories  1     ← structural "General" only
pos_branch_inventory    0
pos_inventory_movements 0
pos_branch_assignments  2     ← one manager, one cashier, both at Cavite Branch
pos_audit_events        0     ← Phase 7C; append-only, see below
```

`pos_audit_events` is append-only and refuses UPDATE, DELETE **and** TRUNCATE
even for the table owner. The documented maintenance path — fixture cleanup, and
any future retention migration — is:

```sql
set session harmony.pos_audit_maintenance = 'allowed';
truncate public.pos_audit_events;
```

Nothing reachable from an API role can set that: no API role holds any privilege
on the table at all.

Several SQL contract fixtures **assume this baseline** and reuse the existing
demo employee accounts. Restore it after any browser or manual testing — the
script is in `AI_WORKFLOW.md` §6.

---

## 10. Known problems and technical debt

### A. Source control has no restore point

The repository root is `C:\Projects\JMAC`. `git status` shows **439 tracked
deletions** and `INTEGRATION/` entirely **untracked**. The last commit is
`eaf09cf`. There is no checkpoint for any of the integration work.

The final Phase 7B audit reran `git status --short`, `git diff --stat`, and
`git diff --name-status`: 440 status lines remain (439 tracked deletions plus
`?? INTEGRATION/`), and the tracked diff remains 439 deleted files / 115,405
deleted lines. This is the known reorganization state, not Phase 7B permission
to restore, delete, move, or reorganize anything.

**Do not commit or push.** Inspect `git status` before major work, and tell the
user if you are about to do something you would want a restore point for. The
user decides when the checkpoint happens.

### B. ~~`database.types.ts` regeneration destroys hand-written aliases~~ RESOLVED

**Fixed 2026-08-25.** Friendly enum aliases now live in **`src/lib/enums.ts`**,
an application-owned module the generator cannot touch. Regenerating is:

```bash
npx supabase gen types typescript --local > src/lib/database.types.ts
npx tsc --noEmit -p tsconfig.app.json
```

Nothing to restore afterwards. `database.types.ts` is purely generated — do not
hand-edit it.

*What it was:* the aliases were appended to the end of the generated file, so
every regeneration deleted them and produced 44 `TS2305` errors across attendance,
payroll, leave, interviews and employees — modules unrelated to whatever change
prompted the regeneration. It cost real time in Phase 7A and again in 7C.

The cleanup also removed 7 aliases nothing imported, and replaced three
hand-written unions of database enums (`ChangeRequestOperation`,
`ChangeRequestStatus` in `useChangeRequests.ts`, and a local `JobPostingStatus`
in `JobPostingsPage.tsx`) with `Enums<'…'>`-derived types, so a future enum
change fails compilation instead of drifting silently.

Verified by regenerating: the generator reproduced the schema content exactly
and left `src/lib/enums.ts` byte-identical.

### C. `supabase_vector_harmony-suite` is restart-looping

Verified still true. It is the logging/vector sidecar; Postgres, Auth, Storage
and the API are all healthy and unaffected. Noise, not a blocker.

### D. Contract fixture assumptions

The SQL suites pick demo accounts deterministically (`order by created_at, id`)
and constrain by role, and they `delete from public.pos_branch_assignments`
before building their own. They still assume the clean POS baseline above, and
the local project has only two `employee` accounts — a suite run against a
database with leftover sales will fail on counts, not on logic.

---

## 11. NON-NEGOTIABLE INTEGRATION DECISIONS

Do not undo these without an explicit instruction from the user.

```text
HRMS/JMAC is the parent system.
No separate POS authentication.
No stores / store_memberships in the integrated HRMS backend.
branches is canonical.
Categories are a GLOBAL enterprise taxonomy.
pos_products is the enterprise product master.
Branch-specific availability and price override live on pos_branch_products.
Branch-specific inventory lives on pos_branch_inventory.
No stock column on pos_products.
Cost stays hidden from POS Managers and Cashiers.
No manager direct stock receiving or adjustment.
Manager Categories is read-only.
Cashier sidebar is POS + Transactions only.
Administrator has no workspace switcher.
Administrator stays inside DashboardLayout.
Manager branch authority never leaks across branches.
Checkout prices, fees and cost are server-derived.
Checkout is atomic and idempotent.
Historical receipts render from snapshots.
No Supabase service-role key in frontend code, ever.
Do not weaken RLS to make a UI work.
Migrations are forward-only.
Do not edit an already-applied migration.
Do not modify INTEGRATION/POS or INTEGRATION/FMS while porting,
  unless explicitly authorized.
```

---

## 12. PostgreSQL ACL — the trap that has caught this project five times

Migration `20260716070000` installs an `ALTER DEFAULT PRIVILEGES` rule that
grants `anon`, `authenticated` and `service_role` on **every new routine and
table** created in `public`. PostgreSQL *separately* grants `PUBLIC EXECUTE` on
every new function by default.

Consequence: **a `REVOKE` statement in a migration is not evidence that the
privilege is gone.** Five separate incidents have been found and fixed here:

1. A POS helper reachable by `PUBLIC`/`anon`.
2. A catalogue RPC left with the default `PUBLIC EXECUTE`.
3. Table-level default DML privileges on a new POS table.
4. `pos_sale_receipt` — the internal receipt helper — executable by
   `authenticated`, which would have made every receipt readable by id.
5. New routines silently re-granted by the default-privileges rule after a
   `CREATE OR REPLACE`.

**The rule going forward:**

- Every new privileged routine: `SECURITY DEFINER`, `SET search_path = ''`.
- Always issue **both** revokes: `revoke all on function … from public, anon;`
  then grant explicitly to `authenticated`.
- Assert the **final privilege state** in a contract test —
  `has_function_privilege('anon', 'public.f(args)', 'execute')` for functions,
  `information_schema.role_table_grants` for tables. Never assert that a REVOKE
  line exists in a file.

---

## 13. Next task — none approved

Phase 7C is complete. **There is no approved next phase**; scope and approval
are required before implementation, as with every phase since 2A.

Candidates, none of them started:

```text
Enterprise Audit Cleanup   remove the legacy generic audit_logs writes still
                           made by checkout_pos_sale, receive_pos_stock and
                           adjust_pos_stock (see the note below)
Refunds / voids / returns  pos_sale_status carries one label, 'completed';
                           every aggregate already filters on it
Inventory requests         restock and new-product requests, with approval
Cashier shifts             cash drawer open/close
PayMongo                   QRPh settlement and reconciliation
FMS bridge                 section 14
Final security review      cross-branch denial sweep, retention/export policy
```

### Legacy enterprise audit writes — deliberate technical debt

Three routines still write generic rows into `public.audit_logs`:

```text
checkout_pos_sale      'POS Sale Completed'   -- LEAVE THIS ALONE
receive_pos_stock      'POS Stock Received'   -- carries unit_cost and
                                                 average_unit_cost
adjust_pos_stock       'POS Stock Adjusted'
```

They duplicate `pos_sales` and `pos_inventory_movements`, which are the
authoritative ledgers. Phase 7C deliberately did **not** remove them:

`checkout_pos_sale` is 293 lines of advisory locking, fingerprint idempotency,
deterministic lock ordering and atomic inventory deduction, proven by a
concurrency harness rather than by reading. Re-emitting all of it to delete six
lines of audit insert is a disproportionate risk for a cosmetic gain, and the
row it writes is admin-only and carries no cost.

`receive_pos_stock` (73 lines) and `adjust_pos_stock` (64 lines) are small
enough to replace safely, and the receive row genuinely puts cost into a shared
table. Doing so is optional and belongs in a deliberate Enterprise Audit Cleanup
— with **both** concurrency harnesses re-run afterwards, and signatures
preserved exactly.

`pos_audit_events` does not read any of those rows, so nothing in Phase 7C
depends on this being resolved.

---

## 14. FMS boundary

FMS integration has **not** begun. POS produces the operational facts FMS will
consume: sales, sale items, payment method, fees, inventory movements, cost
snapshots, COGS-ready facts.

FMS will own suppliers, purchase requests and approval, purchase orders,
supplier invoices and payments, accounts payable, purchase-cost accounting,
cash/bank outflows, journal entries, expenses, payment reconciliation and final
financial profit.

**Do not build any of that into POS.** When FMS eventually triggers receiving,
it must feed the **same** `pos_inventory_movements` ledger — not a second stock
system.
