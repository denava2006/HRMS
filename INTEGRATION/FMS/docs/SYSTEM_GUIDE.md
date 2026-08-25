# Fagle FMS — System Guide

**Finance Management System for Fagle Financial Services Inc.**

This document explains what the system is, who uses it, exactly what each user
does, and how a request travels from submission to a completed transaction. It is
written to match the system as actually built.

---

## Table of contents

1. [Overview](#1-overview)
2. [Objectives](#2-objectives)
3. [Users and roles](#3-users-and-roles)
4. [The approval workflow](#4-the-approval-workflow)
5. [Request status lifecycle](#5-request-status-lifecycle)
6. [Step-by-step process (worked example)](#6-step-by-step-process-worked-example)
7. [What each role does, screen by screen](#7-what-each-role-does-screen-by-screen)
8. [Modules](#8-modules)
9. [Notifications and hand-offs](#9-notifications-and-hand-offs)
10. [Security and access control](#10-security-and-access-control)
11. [Data model](#11-data-model)
12. [Demo accounts and how to run](#12-demo-accounts-and-how-to-run)
13. [Glossary](#13-glossary)

---

## 1. Overview

Fagle Financial Services Inc. is a medium-sized financial consulting company that
provides accounting, bookkeeping, payroll support, tax preparation, and financial
advisory services to businesses throughout the Philippines.

As the company grew, financial operations such as purchase requests,
reimbursements, expense recording, and budget monitoring became difficult to
manage using spreadsheets and paper forms. Manual processing caused delays,
duplicated records, missing receipts, and inaccurate financial reports.

The **Finance Management System (FMS)** replaces that with a single application
that digitizes financial records, automates the approval workflow, manages
budgets, records transactions, and generates real-time reports.

Unlike a traditional CRUD system, the FMS follows a **dynamic workflow** where
*every user's action automatically creates the next user's task* until the request
is completed. Nobody performs the whole process alone.

---

## 2. Objectives

- Digitize financial transactions and eliminate paper-based approvals.
- Automate approval workflows so requests route themselves.
- Monitor department budgets in real time with over-spend alerts.
- Record company income and expenses.
- Generate real-time financial reports.
- Improve accountability through audit logs.
- Secure financial records using role-based access control.

---

## 3. Users and roles

The system has **five roles**. Each reviewing role maps to one stage of the
approval chain. A user has exactly one role, and the sidebar shows only the
modules that role is allowed to use.

| # | Role | Responsibility | Can do | Cannot do |
|---|------|----------------|--------|-----------|
| 1 | **Employee** | Request creator | Create purchase & reimbursement requests, upload receipts, edit before approval, cancel pending requests, track status and history | Approve requests, access financial reports, modify budgets, record transactions |
| 2 | **Finance Staff** | First reviewer | Review submitted requests, verify documents, validate receipts, **check budget availability**, approve, reject, or **return for revision**, add remarks | Give final approval, process payment |
| 3 | **Finance Manager** | Final financial approval | Review validated requests, approve or reject, review company budgets, monitor department spending, view dashboards and reports | Physically process payment, record to ledger |
| 4 | **Accountant** | Completes the transaction | Process payment, upload payment proof, record transactions, create journal entries, update expenses & company balance, generate reports, close the request | Approve or reject requests |
| 5 | **Administrator** | Runs the system | Manage users, departments, categories, roles, company accounts; view audit logs; configure settings | Participate in request approvals (oversight only) |

> **Reviewers vs. requesters:** everyone except the Employee is a *reviewer* who
> can see the full request pipeline. An Employee can see only their own requests
> and cannot see company financial ledgers.

**Once approved at each stage:**

- Finance Staff approves → the request automatically moves to the **Finance Manager**.
- Finance Manager approves → the request automatically moves to the **Accountant**.
- Accountant completes → the system updates the dashboard, reports, budgets, and
  audit logs, and notifies the Employee.

---

## 4. The approval workflow

Every purchase or reimbursement request flows through the same stages. Each stage
is owned by one role; when that role approves, the request automatically becomes
the next role's task.

```
   Employee
      │ Submit Request
      ▼
┌─────────────────────┐
│    Finance Staff     │  approve ──►   reject ✖   ／   return ↩ (back to Employee)
└─────────┬───────────┘
          │ approve
          ▼
┌─────────────────────┐
│   Finance Manager    │  final approve ──►   reject ✖
└─────────┬───────────┘
          │ approve
          ▼
┌─────────────────────┐
│     Accountant       │  process payment · upload proof · record transaction
└─────────┬───────────┘
          │ complete
          ▼
   System Updates ✔
      ├── Dashboard
      ├── Reports
      ├── Budget
      ├── Audit Logs
      └── Employee notification
```

At **every** step the system also:

- writes an immutable row to the **approval history** for that request,
- writes an **audit log** entry, and
- sends a **notification** to whoever must act next.

---

## 5. Request status lifecycle

A request's `status` is the single source of truth for where it is in the chain.

| Status | Meaning | Whose task it is now |
|--------|---------|----------------------|
| `draft` | Being prepared | Employee |
| `pending_finance_staff` | Submitted, awaiting first review | Finance Staff |
| `pending_finance_manager` | Validated, awaiting final approval | Finance Manager |
| `pending_accountant` | Approved, awaiting payment & recording | Accountant |
| `completed` | Paid and recorded to the ledger — **done** | — |
| `returned` | Sent back for revision | Employee |
| `rejected` | Will not proceed | — |
| `cancelled` | Withdrawn by the requester | — |

The dashboard and the Approvals queue read this status to decide what to show
each person. A user only sees requests where the current status belongs to their
role (plus, for reviewers, the rest of the pipeline for visibility).

---

## 6. Step-by-step process (worked example)

**Scenario:** Employee *John Rivera* needs a new company laptop.

**Step 1 — Employee submits.**
John opens **Purchase Requests → New Purchase Request** and enters the title,
amount (₱78,500), department, category, vendor, and justification (uploading a
quotation), then submits.
- Status becomes `pending_finance_staff`.
- Finance Staff receives a notification.

**Step 2 — Finance Staff reviews.**
Finance Staff opens **Approvals**, checks the receipt/quotation, required
documents, and **budget availability**, then chooses one of:
- **Approve** → status `pending_finance_manager`; the Finance Manager is notified.
- **Return** → status `returned`; John is notified to revise (e.g. "attach a quotation").
- **Reject** → status `rejected`; the request stops.

**Step 3 — Finance Manager approves.**
The Finance Manager reviews the validated request and gives **final approval**.
- Status becomes `pending_accountant`; the Accountant is notified.

**Step 4 — Accountant pays and records.**
The Accountant processes the payment (choosing a method — bank transfer, check,
cash, GCash, or credit card), records the reference number, uploads proof of
payment, and records the transaction.
- Status becomes `completed`.
- A **Payment record and an Expense record are created automatically**, the
  budget's spent amount updates, a journal entry is posted, and John is notified
  that his request is complete.

**Result:** the dashboard totals, budget utilization, reports, and audit log all
reflect the finished transaction. No single person did everything — each did one
step and handed off to the next.

---

## 7. What each role does, screen by screen

### Employee
1. **Dashboard** — sees *My Open Requests*, *Total Requests*, *Completed*, and
   anything *Returned* that needs revision, plus a diagram of how a request moves.
2. **Purchase Requests / Reimbursements** — creates requests and tracks their status.
3. **Notifications** — sees when a request is returned, rejected, or completed.

### Finance Staff
1. **Approvals** — the work queue of `pending_finance_staff` requests, each with
   Approve / Return / Reject and a remarks box.
2. **Budgets / Income / Expenses** — check budgets and encode financial records.

### Finance Manager
1. **Approvals** — `pending_finance_manager` requests for final approval.
2. **Budgets** — approve and monitor budgets.
3. **Reports / Audit Logs** — oversight of finances and actions.

### Accountant
1. **Approvals** — `pending_accountant` requests to pay and record.
2. **Payments / Income / Expenses** — release payments and maintain the ledger.
3. **Reports** — produce financial reports.

### Administrator
1. **Users** — manage people and their roles.
2. **Departments / Categories** — manage master data.
3. **Audit Logs** — review the full trail of actions.

---

## 8. Modules

| Module | Who sees it | What it does |
|--------|-------------|--------------|
| **Dashboard** | Everyone (role-aware) | KPI cards (income, expenses, net profit, remaining budget — or request counts for employees), income-vs-expense chart, budget utilization bars, pending-action list, recent activity |
| **Approvals** | Reviewers | Per-role work queue; approve / return / reject with remarks; progress timeline |
| **Purchase Requests** | Everyone | List and create requests to buy goods/services |
| **Reimbursements** | Everyone | List and create out-of-pocket expense claims |
| **Budgets** | Finance | Per-department budgets with allocation, real-time spend, and over-threshold alerts |
| **Income** | Finance | Recorded income by category, account, and department; running total |
| **Expenses** | Finance | Recorded expenses with category, vendor, and payment status |
| **Payments** | Finance Mgr, Accountant | Released payments: method, reference, account, status, proof |
| **Reports** | Reviewers | Income, expense, budget, department, monthly, and yearly reports with PDF/Excel export |
| **Notifications** | Everyone | Personal inbox of hand-offs and outcomes; mark read / mark all read |
| **Users** | Administrator | Manage users, roles, departments, status |
| **Departments** | Administrator | Departments, their managers, and member counts |
| **Categories** | Admin, Finance Mgr | Income and expense classifications |
| **Audit Logs** | Admin, Finance Mgr | Every action: who, what, when, on which record |
| **Profile** | Everyone | Personal account details and what the role can do |

> **Note on scope:** Report PDF/Excel export, receipt/proof file uploads to
> storage, and admin create/edit forms are prepared in the data model but their
> UI actions are placeholders in the current build.

---

## 9. Notifications and hand-offs

The hand-off is what makes the system dynamic. When a request changes hands the
system automatically notifies the **role** that must act next — not a single
hard-coded person — so any user with that role can pick it up:

- Submit → notifies **Finance Staff** ("New Purchase Request submitted").
- Finance Staff approves → notifies the **Finance Manager** ("Request awaiting approval").
- Finance Manager approves → notifies the **Accountant** ("Request ready for payment").
- Accountant completes → notifies the original **requester** ("Your request has been completed").
- Returned / rejected → notifies the **requester** with remarks.

The unread count appears on the bell icon in the top bar; the Notifications page
lists them and links straight to the relevant screen.

---

## 10. Security and access control

Access is enforced in **two layers**:

1. **Role-based navigation** — the sidebar and pages only show what a role may use.
2. **Row Level Security (RLS) in the database** — every table has policies so the
   rules hold even if the interface is bypassed. For example:
   - an Employee can read only their **own** requests and **no** financial ledgers;
   - only Finance roles can write income/expenses and budgets;
   - only the Accountant (or Finance Manager/Admin) can write payments;
   - only the Accountant can post journal entries;
   - only Admins and Finance Managers can read audit logs.

Sessions are cookie-based and refreshed on every request; unauthenticated visitors
are redirected to the login screen. The server-only service key is never exposed
to the browser.

---

## 11. Data model

The main tables (see `supabase/migrations/`):

| Group | Tables |
|-------|--------|
| People & structure | `profiles` (users), `roles`, `departments` |
| Master data | `categories`, `vendors`, `accounts` |
| Requests | `requests` (purchase + reimbursement), `request_attachments`, `request_approvals` (history) |
| Budgeting | `budgets`, `budget_allocations` |
| Ledger | `income`, `expenses`, `payments`, `journal_entries` |
| System | `notifications`, `audit_logs`, `reports` |

Design highlights:

- **One `requests` table** powers both purchase and reimbursement requests via a
  `type` column; views `purchase_requests` and `reimbursement_requests` expose
  each as its own "table."
- **Database triggers** auto-generate reference numbers (`PR-2026-0001`,
  `PAY-2026-0001`, …) and keep each budget's *spent* amount in sync with expenses.
- **`request_approvals`** is an append-only history — the paper trail of who did
  what at each stage.

---

## 12. Demo accounts and how to run

Every demo account uses the password **`Password123!`**. On the login screen you
can click a role chip to sign in with one click.

| Role | Email |
|------|-------|
| Employee | `employee@fagle.ph` |
| Finance Staff | `finance.staff@fagle.ph` |
| Finance Manager | `finance.manager@fagle.ph` |
| Accountant | `accountant@fagle.ph` |
| Administrator | `admin@fagle.ph` |

**To run locally** (Docker required):

```bash
npm install
npm run db:start     # starts Supabase, applies migrations, seeds demo data
# copy the printed keys into .env.local
npm run dev          # http://localhost:3000
```

**To see the whole workflow:** sign in as the **Employee** and submit a request →
sign in as **Finance Staff** and approve it from *Approvals* → **Finance Manager**
gives final approval → **Accountant** pays and records it, and the dashboard,
payments, expenses, and audit log all update. Full reset any time with
`npm run db:reset`.

---

## 13. Glossary

- **Request** — a purchase or reimbursement submitted by an employee.
- **Approval chain / workflow** — the fixed sequence of roles a request passes
  through.
- **Status** — where a request currently sits in the chain.
- **Reviewer** — any role above Employee; can see the whole pipeline.
- **RLS (Row Level Security)** — database rules that restrict which rows a user
  can read or change.
- **Audit log** — the record of every action taken in the system.
- **Ledger** — the income, expenses, payments, and journal entries that make up
  the company's financial records.
