# AI_WORKFLOW.md — how to work in this repository

**Workspace:** `C:\Projects\JMAC\INTEGRATION`
**Application:** `INTEGRATION/HRMS` (package `harmony-suite`)
**Last updated:** 2026-08-25, after Phase 7C

Read `AI_HANDOFF.md` first for *what* the system is and where it stands. This
file is *how* to work on it.

---

## 1. Before editing anything

1. Read `AI_HANDOFF.md`, then `ARCHITECTURE.md` for whatever area you are about
   to touch.
2. Run `git status`. The tree has no restore-point commit for the integration
   work — know what was already dirty before you add to it.
3. **Inspect the real implementation before changing it.** Read the migration
   that created the function, and query the live database for the current
   signature and privileges. Documentation — including this set of files — can
   drift; `pg_proc` cannot.
4. Check whether the behaviour you are about to build already exists somewhere.
   Reuse hooks, RPCs, components and patterns rather than adding a parallel one.

### The two reference systems

```text
INTEGRATION/POS   READ-ONLY REFERENCE   the standalone SariSwift POS
INTEGRATION/FMS   READ-ONLY REFERENCE
```

Read them to understand what a feature *did*. **Do not modify them.** And do not
port their decisions uncritically — several are actively wrong for the
integrated system, and the divergences are documented with reasons in
`POS_TO_HRMS_MIGRATION_CLAUDE(1).md`. The standalone gave POS Managers profit
figures and full category CRUD; the integrated system must not.

---

## 2. Phase discipline

Substantial work here runs as an explicit cycle:

```text
plan  →  user approves  →  implement  →  verify  →  report  →  STOP
```

- For anything touching authorization, RLS, money, or a schema change: **write
  the plan first and get approval before coding.** Every phase from 2A to 7C ran
  this way, and it caught real design problems before they became migrations.
- Implement only the approved scope. Do not start the next phase automatically.
- Stop and report when the phase is done.

---

## 3. Database changes

- **Forward-only migrations.** Never edit a migration that has already been
  applied — write a new one.
- Never reset or reseed the project database casually. `npm run demo:reset`
  exists but drops everything; treat it as the user's call, not yours.
- Apply with `npx supabase migration up --local` **from the `HRMS` directory**
  (from anywhere else the CLI looks for the wrong project and fails with a
  confusing `LegacyDbConnectError`).
- New privileged routine? `SECURITY DEFINER`, `SET search_path = ''`, then
  **both** revokes and an explicit grant:

  ```sql
  revoke all on function public.f(args) from public, anon;
  grant execute on function public.f(args) to authenticated;
  ```

- Prefer explicitly typed `returns table (...)` over `returns jsonb` for
  anything a cost-safety test needs to inspect. A `jsonb` return makes "declares
  no cost column" unassertable.

### The ACL rule

A `REVOKE` line in a migration is **not** evidence the privilege is gone. This
project carries an `ALTER DEFAULT PRIVILEGES` rule that re-grants `anon` and
`authenticated` on every new routine and table in `public`, and PostgreSQL grants
`PUBLIC EXECUTE` besides. **Six** separate incidents have come from trusting the
statement instead of the catalog.

Assert the **final state**:

```sql
has_function_privilege('anon', 'public.f(uuid,date)', 'execute')   -- must be false
select * from information_schema.role_table_grants where table_name = '…';
```

And remember what RLS does **not** cover. Incident six was TRUNCATE, granted to
`anon` and `authenticated` on 36 tables: RLS filters rows for
SELECT/INSERT/UPDATE/DELETE, but TRUNCATE is not a row operation, so no policy
is ever consulted. A table can look airtight in `pg_policies` and still be
wipeable in one statement. When you add a table, check its privileges — not its
policies.

---

## 4. Regenerating Supabase types

```bash
npx supabase gen types typescript --local > src/lib/database.types.ts
npx tsc --noEmit -p tsconfig.app.json
```

That is the whole procedure. `database.types.ts` is now purely generated — do
not hand-edit it, and do not append anything to it.

Friendly names for the database enums (`UserRole`, `PosRole`,
`AttendanceStatus`, …) live in **`src/lib/enums.ts`**, which the generator
cannot touch. Six domain modules own the alias for the enum they are about —
`applicationStatusLabels.ts`, `jobPostingLabels.ts`, `deploymentLabels.ts`,
`posInventory.ts`, `posTransactions.ts` — and those stay where they are.

Adding a new enum in a migration? Regenerate, then add one line to
`src/lib/enums.ts`:

```ts
export type MyThing = Enums<'my_thing'>
```

Always `Enums<'…'>`, never a hand-written string union. The union compiles
happily after the database changes underneath it; the alias does not, which is
the point.

> Until 2026-08-25 these aliases were appended to the *end of the generated
> file*, so every regeneration deleted them and produced 44 `TS2305` errors in
> unrelated HR modules. That is fixed and the manual restore step is gone.

---

## 5. The verification sequence

Run this before reporting a phase complete. Everything below has been green as of
Phase 7C; a regression is yours.

```bash
cd C:\Projects\JMAC\INTEGRATION\HRMS

npm test          # 445 tests, 31 files
npm run build     # tsc -b && vite build
npm run lint      # oxlint
```

**Database contract suites** — each runs in one transaction and rolls back:

```bash
for t in pos_access_rls pos_branch_settings_rls pos_catalogue_rls \
         pos_inventory_rls pos_checkout_rls pos_transactions_rls pos_dashboard_rls; do
  docker exec -i supabase_db_harmony-suite psql -U postgres -d postgres \
    -v ON_ERROR_STOP=1 -f - < supabase/tests/$t.sql
done
```

9 suites, 295 checks. They assume the clean POS baseline (§6).

**Concurrency harnesses** — two-session races for lost updates and double charge:

```bash
bash scripts/pos-inventory-concurrency.sh
bash scripts/pos-checkout-concurrency.sh
```

**Standalone POS regression** — the reference system must stay untouched:

```bash
cd ..\POS && npm test     # 9 files, 61 tests
```

**Browser verification.** Required for anything with a UI. Start `npm run dev`
and drive a real browser. Playwright is not a dependency of HRMS; it is borrowed
via `NODE_PATH` from another local project — check what is available on the
machine before assuming.

> **Never claim browser testing was performed unless it actually was.** Report
> browser results separately from automated test results, and say how many
> checks ran.

Restore the POS baseline afterwards (§6).

---

## 6. The clean POS baseline

Contract fixtures assume this state, and browser testing destroys it. Restore
after any manual or browser session:

```sql
-- Restore the POS tables to baseline: one structural category ("General"),
-- no products, no stock, no sales, and the two demo assignments intact.
begin;
delete from public.pos_sale_items;
delete from public.pos_sales;
delete from public.pos_inventory_movements;
delete from public.pos_branch_inventory;
delete from public.pos_branch_products;
delete from public.pos_products;
delete from public.pos_product_categories where name <> 'General';
commit;

-- Phase 7C events. The table is append-only and refuses TRUNCATE even for the
-- owner; this is the documented maintenance path, and nothing reachable from an
-- API role can set it.
set session harmony.pos_audit_maintenance = 'allowed';
truncate public.pos_audit_events;
```

Expected afterwards:

```text
sales = 0   sale_items = 0   products = 0   categories = 1
inventory = 0   movements = 0   assignments = 2   audit_events = 0
```

`pos_branch_assignments` is deliberately **not** cleared — the two demo
assignments (one manager, one cashier, both at Cavite Branch) are what the
fixtures and the browser scripts expect. The contract suites clear and rebuild
assignments inside their own rolled-back transaction.

Demo credentials are in `HRMS/DEMO.md`. Do not copy them into any handoff or
architecture document.

---

## 7. Git

**AI agents never commit or push.** The user owns staging, commits, pushes,
branches and merges.

Do not:

```text
git commit · git push · force push · git reset --hard
delete branches · rewrite history · discard unrelated user changes
```

Before editing, inspect `git status`. After editing, report:

1. Every file modified, added or deleted.
2. Why each changed.
3. Whether the tree contains unrelated pre-existing changes.

---

## 8. Scope and communication

- Do not refactor, rename or reformat outside the task.
- Explain a significant architectural decision before acting on it, not after.
- Preserve existing UI conventions — spacing, typography, the hand-authored
  `components/ui` primitives, the existing colour tokens — unless a redesign was
  asked for.
- Do not implement FMS. It is not part of the active integration.
- When you find a real problem outside your scope, say so and keep going; don't
  silently widen the work.

### Reporting a phase

State plainly what was built, what was verified and how, what you did not do,
and anything you are unsure about. If a test fails, show the output. If a step
was skipped, say which. Do not round a partial result up to "done".

---

## 9. Context / usage limit

When you approach your context or usage limit:

1. Stop starting new implementation work.
2. Finish only the current atomic operation if stopping midway would leave the
   code invalid.
3. Update `AI_HANDOFF.md` with the complete current state: current task,
   completed work, unfinished work, exact files modified, decisions made, known
   issues, tests already run and their results, browser results, current
   `git status`, and the exact next step.
4. Do not commit or push.
5. Stop.

The receiving agent reads `AI_HANDOFF.md`, then `ARCHITECTURE.md`, then inspects
`git status` and the diff before continuing.

---

## 10. Two-agent rule

Only one agent may modify the working tree at a time. The other stays read-only
until an explicit handoff. Review findings go to `CODEX_FINDINGS.md` or into
`AI_HANDOFF.md`, classified as `confirmed` / `false positive` / `already fixed`
/ `deferred`. Do not change production code on the strength of a review finding
alone — verify it first. Other agents are sometimes wrong.

**Current state: Claude has handed off. Codex is the active implementer.**
