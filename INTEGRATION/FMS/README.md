# Fagle FMS — Finance Management System

A centralized Finance Management System for **Fagle Financial Services Inc.** that
digitizes financial records, automates a multi-stage approval workflow, tracks
budgets in real time, and keeps an audit trail — built so that **each user's
action triggers the next user's task**.

Employee → Finance Staff → Finance Manager → Accountant → paid & recorded to the
ledger, dashboard, and audit log.

## Tech stack

| Layer | Choice |
|------|--------|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS (glassmorphism, blue/emerald palette, dark mode) |
| Backend / DB / Auth | Supabase (Postgres + Auth + Row Level Security) |
| Charts | Recharts (CVD-safe, validated palette) |
| Icons | lucide-react |

There is **no separate API server** — Next.js Server Components, Server Actions,
and Supabase Row Level Security handle data access and the workflow logic.

## Prerequisites

- **Node.js 18+** (built with Node 24)
- **Docker Desktop** — required to run Supabase locally
- **Supabase CLI** — bundled via `npx supabase`

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Start the local Supabase stack (Postgres, Auth, Studio, …).
#    Applies the migrations in supabase/migrations and seeds demo data.
npm run db:start          # = supabase start

# 3. Copy the keys it prints into .env.local
cp .env.local.example .env.local
#    then paste API URL + anon key from `supabase status` (or step 2's output)

# 4. Run the app
npm run dev               # http://localhost:3000
```

If you ever change the SQL, re-apply everything cleanly with:

```bash
npm run db:reset          # = supabase db reset  (re-runs migrations + seed)
```

> **Note:** `NEXT_PUBLIC_*` env vars are inlined at **build** time. `npm run dev`
> reads them at runtime, but if you `npm run build`, make sure `.env.local`
> holds the real keys first.

## Demo accounts

Every account uses the password **`Password123!`**. On the login screen, click a
role chip to sign in with one click.

| Role | Email | Can do |
|------|-------|--------|
| Employee | `employee@fagle.ph` | Submit purchase/reimbursement requests, track status |
| Finance Staff | `finance.staff@fagle.ph` | First review — validate, check budget, approve / return / reject; allocate from a budget |
| Finance Manager | `finance.manager@fagle.ph` | Final approval, **sets the budgets**, reports |
| Accountant | `accountant@fagle.ph` | Process payment, record transactions, ledger, reports |
| Administrator | `admin@fagle.ph` | Everything — users, departments, categories, budgets, audit logs, and can act at any open workflow stage |

The Administrator oversees the whole system: they appear in **Approvals** for
every open request and can validate, approve, pay, return or reject at any stage,
plus cancel any request that has not closed. Two limits are deliberate — an admin
cannot act on a request that is already completed, rejected or cancelled, and the
department budget rules still apply to them exactly as they do to Finance.

**Try the workflow:** sign in as the Employee and submit a request → sign in as
Finance Staff and approve it from **Approvals** → Finance Manager gives final
approval → Accountant pays and records it. Each approval notifies and unlocks the
next role, and the completed transaction lands in Payments, Expenses, the
dashboard, and the Audit Log.

## Request lifecycle

```
Submitted → Finance Review → Finance Approved → Payment Processing → Completed
                  │
                  ├── Returned → Employee edits → Resubmitted → Finance Review
                  └── Rejected → Closed
```

Open any request by clicking its reference number to see the full picture:
progress timeline, details, attachments and the complete audit trail.

**Returned is not a dead end.** Returning requires remarks, and the requester
sees the status, who returned it and why, plus **Edit Request** and **Resubmit**
buttons. They may change the title, description, vendor, amount, needed date,
category and attachments — the request number, department and requester are
fixed. Resubmitting sends it back to Finance Staff as a fresh review.

**Rejection is permanent.** It also requires remarks. The requester can view the
reason but cannot edit or resubmit; they must create a new request. Row Level
Security enforces this, not just the UI — an employee can only update their own
request while it is a draft or returned, and may withdraw it only before Finance
Staff has picked it up.

**Every action is logged** to `request_approvals` and shown on the request
timeline: submitted, edited, resubmitted, validated, approved, payment processed
and the closing transaction entry — each with actor, role, timestamp and remarks.

Attachments (quotations, receipts) live in a private Storage bucket laid out as
`<request_id>/<file>`; the Storage policies read that first path segment so only
the requester and reviewers can open them, via short-lived signed URLs.

## Who handles the budget

Budget authority is split between two people, and deliberately excludes the
Administrator — they manage *access*, never amounts (separation of duties). This
is enforced by RLS in `supabase/migrations/0004_budget_ownership.sql`, not just
hidden in the UI:

| Who | Does |
|-----|------|
| **Finance Manager** | Sets the ceilings on **Budgets → Set Budget** — monthly, quarterly or yearly, per department or company-wide, with an alert threshold. |
| **Administrator** | Handles budget allocation as a system duty, with the same rights as the Manager. |
| **Finance Staff** | Draws **allocations** from a ceiling already set (**Allocate** on any budget card). Cannot raise the ceiling itself. |
| Accountant | Read-only view of utilization. |

Each budget card shows **Allocated · Spent · Remaining** side by side with exact
utilization and a health chip — 🟢 Healthy, 🟡 Warning above 80%, 🟠 Budget Fully
Utilized at exactly 100%, 🔴 Budget Exceeded beyond it.

Utilization is live: a new request is automatically charged to the active budget
covering its department, and when the Accountant completes the request the
recorded expense moves `budgets.spent`. Crossing the alert threshold notifies the
Finance Manager.

### Budget validation on approval

No department can spend past its allocated budget. When Finance Staff click
**Validate & Approve** — or the Finance Manager gives final approval — the system
checks:

```
Remaining = Allocated − Approved Expenses          approve if Remaining >= Requested
```

**Approved Expenses** is two things: expenses already paid and recorded
(`spent`) *plus* budget **reserved** by requests that cleared final approval and
are waiting on the Accountant. Without that second half, several approved
requests could together blow past the ceiling, because `spent` only moves once
the payment is recorded.

If the request does not fit, a **Budget Validation Failed** modal shows the
department, remaining budget, requested amount and the shortage — and nothing is
written. The request keeps its status, does not move to the next approver, and no
budget is deducted. The blocked attempt is recorded in the Audit Log as
`budget_blocked`. Requests with no governing budget are not blocked, since there
is no ceiling to measure them against.

### Budget reservation

Submitting a request does not touch the budget, and neither does Finance Staff
validation — up to that point the request can still be returned or rejected, so
it must not hold money down. The budget moves at **final approval**:

```
Submitted → Finance Review → Finance Approval → [reserve] → Accountant → Completed
                                                                          [released
                                                                           as spent]
```

`reserved` is **derived from request status**, not stored on the budget — see the
`budget_status` view in `supabase/migrations/0005_budget_reservation.sql`. One
source of truth means it cannot drift: a reservation appears the instant a
request reaches *Pending Accountant* and disappears the instant it leaves,
whether it was paid, rejected or cancelled. It also makes double deduction
impossible — at completion the request drops out of `reserved` at the same moment
the expense lands in `spent`, so `remaining` does not move twice.

The Budgets page shows this directly: each bar has a solid segment for money
spent and a lighter amber segment for money reserved.

## Project structure

```
FMS/
├── src/
│   ├── app/
│   │   ├── login/                 # auth screen (client sign-in + demo chips)
│   │   ├── auth/signout/          # sign-out route handler
│   │   └── (app)/                 # authenticated shell (sidebar + topbar)
│   │       ├── dashboard/         # role-aware KPIs, income/expense chart, activity
│   │       ├── approvals/         # per-role work queue + approve/return/reject
│   │       ├── purchase-requests/ #   + /new create form
│   │       ├── reimbursements/    #   + /new create form
│   │       ├── budgets, income, expenses, payments, reports,
│   │       ├── notifications, profile,
│   │       └── users, departments, categories, audit-logs   (admin/finance)
│   ├── components/                # sidebar, topbar, cards, table, chart, timeline
│   └── lib/
│       ├── supabase/              # browser / server / middleware clients
│       ├── rbac.ts                # role metadata & permission helpers
│       ├── workflow.ts            # the approval chain + status metadata
│       ├── navigation.ts          # per-role sidebar model
│       ├── actions.ts             # server actions: create + advance requests
│       └── auth.ts, types.ts, utils.ts
├── middleware.ts                  # session refresh + route protection
└── supabase/
    ├── migrations/
    │   ├── 0001_schema.sql        # tables, enums, workflow status, views, indexes
    │   ├── 0002_functions_rls.sql # role helpers, triggers, RLS policies, grants
    │   └── 0003_reference_data.sql# roles, departments, categories, accounts, vendors
    └── seed.sql                   # demo users (1 per role) + sample data for charts
```

## How the workflow is modeled

- **One `requests` table** powers both purchase and reimbursement requests
  (`type` column). Views `purchase_requests` and `reimbursement_requests` expose
  each as its own "table" as named in the spec.
- **`request_status`** enum encodes the pipeline: `pending_finance_staff →
  pending_finance_manager → pending_accountant → completed` (plus `returned`,
  `rejected`, `cancelled`).
- **`src/lib/workflow.ts`** maps each status to the role that owns it and the next
  status on approval. The `actOnRequest` server action moves the request, writes
  an immutable row to `request_approvals`, logs an `audit_logs` entry, notifies
  the next role, and — when the Accountant completes it — creates the `payments`
  and `expenses` rows automatically.
- **Row Level Security** enforces the rules in the database itself: employees see
  only their own requests and no financial ledgers; reviewers see the whole
  pipeline; only the right role can write to each table.

## Security notes

- Access control lives in the database via **RLS policies** (see
  `0002_functions_rls.sql`), so it holds even if the UI is bypassed.
- The `SUPABASE_SERVICE_ROLE_KEY` is server-only and never shipped to the browser.
- Demo credentials and local Supabase keys are for **local development only** —
  never reuse them for a hosted deployment.

## Available scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:start` / `db:reset` / `db:push` | Supabase local stack management |
| `npm run db:types` | Regenerate TypeScript types from the local DB |
