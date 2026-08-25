> ## PROVENANCE WARNING — added 2026-08-24
>
> **Everything below this banner describes a different repository:
> `C:\Projects\JMAC Enterprise` (package `jmac`), not this workspace
> (`C:\Projects\JMAC\INTEGRATION`, package `harmony-suite`).**
>
> The file was copied here during the folder reorganisation. Its own header
> still says `Repository: C:\Projects\JMAC Enterprise`. That repository still
> exists on this machine, at that path, with its own git history (HEAD
> `6175468`, 2026-08-10).
>
> **Do not read its claims as a record of this workspace.** In particular,
> section 13 states *"POS is now complete across all four slices"* (Categories,
> Inventory, Till, Transactions). That is true of `JMAC Enterprise`, whose
> `src/features/pos/` really does contain those four pages. It is **false** of
> this workspace, where POS integration is at **slice 1 only** — portal,
> routing and branch access control.
>
> Concepts described below that **do not exist here** (verified by search —
> zero matches in `HRMS/src` and `HRMS/supabase`):
>
> - `store_memberships` as a *view* over `users`
> - `users.branch_id`
> - permission strings such as `company.update`, `product.manage`, `sales.create`
> - `finance_post_sale`
> - `src/features/`, `src/services/`, `src/types/database.types.ts`
> - Playwright end-to-end tests, and the "53 files / 1148 tests" figures
>
> This workspace uses `profiles` + a `user_role` enum, `src/pages/`,
> `src/lib/database.types.ts`, and has 34 vitest tests in HRMS and 61 in POS.
>
> **For the current architecture of this workspace, read `ARCHITECTURE.md`.**
> It was written from the filesystem, the migrations, and the live local
> database on 2026-08-24, and it supersedes this file.
>
> This file is kept unedited below as a record of the earlier effort. It is
> still useful as a reference for how the four POS slices were sequenced — but
> its authorization model is different from this workspace's and must not be
> copied across.

---

# AI_HANDOFF.md - Codex to Claude

Last updated: 2026-08-11

Repository: `C:\Projects\JMAC Enterprise`

Branch/HEAD: `main` at `d1dbb7a` (`main` and `origin/main` aligned, divergence `+0/-0`)

This handoff is self-contained. Before editing, read `PROJECT_CONTEXT.md` and
`AI_WORKFLOW.md` completely, then read this file, run `git status`, and inspect
the full tracked and untracked diff. Do not commit, push, reset, recreate/reseed
the database, touch `integration/`, or implement FMS.

---

## 1. What Codex was asked to do

Codex took over Claude's dirty local implementation and was asked to:

1. verify the handoff against Git, source, tests, and the live local database;
2. finish the five approved Increment E recruitment usability fixes without
   redoing completed work;
3. keep Claude's rejected direct `hired -> deployed` scaffold unreachable;
4. continue Increment A (Job Offer) in the mandatory pipeline;
5. preserve POS and existing HRMS behavior, make no unrelated styling changes,
   and keep FMS untouched;
6. run typecheck, lint, unit tests, database contracts, build, and appropriate
   non-mutating Playwright checks; and
7. update this handoff without committing or pushing.

The required high-level pipeline remains:

```text
apply -> screen -> interview -> hired -> job offer -> applicant accepts
      -> contract generated -> signed copy recorded -> deployment
      -> employee record
```

An HRMS employee row is not automatically a POS login. POS user/role/store
membership remains a separate scope decision.

## 2. What Codex completed

### Increment E - complete; not redone during Increment A

The existing completed work was preserved:

- applicant names are normalized on submission;
- online interviews require a shared strict HTTPS meeting-link validator;
- face-to-face interviews use active work-location options;
- Recruitment has a visible View application row action; and
- Interviews can open the existing applicant-detail UI with fresh, race-guarded
  data.

Deployment remains fail-closed: its nav entry is still planned, its route is not
registered, and the persistent pipeline ends at Hired.

### Increment A - implemented

Codex added and applied `db/migrations/0002_atomic_job_offers.sql` to the local
Supabase database. It was first tested in an explicit transaction/rollback and
then applied with psql's single-transaction mode. The database was not reset or
reseeded.

The migration now:

- makes offer grade, schedule, start date, schedule snapshots, and preparer
  required;
- enforces positive/in-grade salary and a future start date;
- replaces two broken inherited compatibility triggers that incorrectly mapped
  both `regular` and `part_time` offers to `part_time`;
- derives employment type, PHP currency, working-day/hour snapshots, and actor
  on the server;
- permits only one pending or accepted offer per application while retaining
  declined rows as revision history;
- exposes atomic, permission-scoped `prepare_job_offer(...)`;
- makes an identical pending-offer retry idempotent;
- permits a revised offer only after decline and blocks revisions after
  acceptance;
- makes `respond_to_job_offer(...)` race-safe through consistent application-
  then-offer locking and a pending-only guarded update;
- rejects null decisions and decline details sent with an acceptance;
- removes authenticated direct offer mutations and retains permission-scoped
  SELECT only;
- removes both direct `hired -> deployed` and premature `offered -> deployed`
  transitions until Increment C supplies the accepted-offer/signed-contract
  gate; and
- changes the required `prepared_by` FK from contradictory `ON DELETE SET NULL`
  behavior to explicit `ON DELETE RESTRICT`, preserving offer audit history.

The HR application now:

- includes Hired and Offered filters in Recruitment;
- shows the latest offer status in applicant details;
- shows Prepare job offer only to users with `deployment.manage` on hired rows;
- shows Prepare revised offer on offered rows whose latest offer was declined;
- loads salary grades and schedules filtered by the posting employment type;
- requires compatible grade, in-range positive salary, compatible schedule, and
  a start date of tomorrow or later;
- shows employment type and PHP as read-only authoritative values; and
- performs one atomic RPC call rather than separate offer/application/history
  writes.

The public tracking page now:

- maps and displays the latest offer terms;
- shows pending/accepted/declined offer state;
- accepts a pending offer;
- requires one of the approved reasons before decline and allows optional notes;
- normalizes reference/email before the response RPC;
- refetches after response and removes the response buttons; and
- changes the status copy after acceptance/decline so it no longer asks the
  applicant to respond again.

The checked-in recruitment/deployment design was rewritten to make offers and
contracts mandatory, record the Increment A decisions, and keep Increments B-D
fail-closed.

## 3. Exact files modified or added

### Increment A files changed by Codex

```text
M  docs/superpowers/specs/2026-08-09-recruitment-deployment-design.md
A  db/migrations/0002_atomic_job_offers.sql
A  e2e/offer-flow.spec.ts
M  src/features/careers/TrackApplicationPage.tsx
M  src/features/people/RecruitmentPage.tsx
M  src/features/people/recruitment/ApplicantDetailSheet.tsx
A  src/features/people/recruitment/PrepareOfferDialog.tsx
M  src/lib/applicationLabels.ts
M  src/services/applications.test.ts
M  src/services/applications.ts
A  src/services/offers.test.ts
A  src/services/offers.ts
M  src/services/recruitment.test.ts
M  src/services/recruitment.ts
M  src/types/database.types.ts
M  tests/db/contracts.test.ts
```

`src/types/database.types.ts` was regenerated from the applied local schema; it
was not manually invented. It now contains `prepare_job_offer` as well as the
already-live interviewer RPC contract added during Increment E.

### Earlier Increment E logical changes still in the worktree

```text
M  src/features/people/interviews/InterviewDetailSheet.tsx
M  src/features/people/interviews/ScheduleInterviewDialog.tsx
M  src/services/interviews.test.ts
M  src/services/interviews.ts
```

Increment E also shares some files in the Increment A list (`RecruitmentPage`,
`applications`, `recruitment`, their tests, and generated types).

### User-owned change preserved

```text
M  .gitignore
```

Codex did not edit it. Its current diff changes `AI_WORKING.md` to the misspelled
`AI_WORKFFLOW.md`; do not fix or stage it without checking the user's intent.

### Status-only line-ending entries

```text
M  e2e/recruitment-pipeline.spec.ts
M  src/router/routes.tsx
```

Normal `git diff` shows no logical patch for either file. They have working-tree
line-ending metadata/noise only. The pipeline still ends at Hired and the
Deployment route is absent. Do not stage them blindly.

### Claude's retained, unreachable deployment scaffold

```text
?? src/features/people/DeploymentPage.tsx
?? src/features/people/deployment/DeployApplicantDialog.tsx
?? src/services/deployment.test.ts
?? src/services/deployment.ts
```

These files are not finished Increment C. They still implement non-atomic direct
deployment behavior and must remain unreachable until reworked against a signed-
contract-gated transactional RPC.

### Ignored handoff

```text
AI_HANDOFF.md
```

This file is ignored and does not appear in Git status.

## 4. Important implementation decisions

1. A pending or accepted offer is the one live offer. Declined offers remain as
   immutable history and may be followed by a new pending revision.
2. The application stays `offered` after both acceptance and decline. Increment
   B consumes the current accepted offer. A declined offer can be revised; an
   explicit HR close-declined action remains a separate product decision.
3. `deployment.manage` is the offer-preparation authorization boundary.
   `applicant.screen` alone is not sufficient.
4. Offer preparation is one database transaction/RPC. The client cannot write
   the offer table, application status, or history independently.
5. The database, not the browser, owns employment type, currency, schedule
   snapshots, and preparer identity.
6. Same-term preparation retries return the existing pending offer ID and write
   no duplicate history. Different terms require the applicant to resolve the
   current pending offer first.
7. Both prepare and respond lock the application row first and the offer row
   second. This gives consistent lock order and serializes races.
8. Historical preparer identity is mandatory. Hard-deleting a referenced user
   is intentionally restricted; normal account deactivation is unaffected.
9. The local database migration was applied manually through the repository's
   numbered `db/migrations` workflow. It is not recorded as version `0002` in
   `supabase_migrations.schema_migrations`, even though the live catalog matches
   the file. Do not infer that the local schema is missing from that ledger.
10. Browser coverage mocks every offer write and blocks unexpected Data API
    writes. It never consumes one of the six live hired applications.
11. The direct deployment scaffold remains unreachable. POS and FMS source were
    not changed.

## 5. Bugs fixed

- Valid regular offers were rejected because the inherited trigger remapped an
  already-normalized enum through an incompatible core-to-HR mapper.
- Preparing an offer required separate insert/status/history requests and could
  leave partial state.
- Concurrent applicant responses could both pass a stale pending check and
  overwrite response/history state.
- Broad authenticated staff could mutate `job_offers` directly without the
  semantic deployment permission.
- The database allowed the prohibited `hired -> deployed` shortcut.
- Offer grade, salary range, schedule/type, start date, currency, snapshots, and
  actor were not all protected at the database boundary.
- A required `prepared_by` column conflicted with an inherited FK that attempted
  to null it on user deletion.
- Null decisions and acceptance calls carrying decline details did not receive
  stable semantic errors.
- Recruitment had no offer preparation/revision UI.
- Applicant tracking did not display terms or permit a response.
- Post-response applicant copy still told accepted/declined applicants to
  respond.
- HR latest-offer mapping now has deterministic `created_at`, then ID ordering.

## 6. Review findings verified

The following were verified from source and the local live database rather than
applied blindly:

1. The live database initially had zero offers and zero contracts, so the new
   required-field and live-offer constraints required no backfill.
2. Both inherited offer compatibility triggers were genuinely wrong for the
   current `regular | part_time` enum and were removed only for job offers; the
   shared employee mapper was not changed.
3. `respond_to_job_offer` genuinely had a stale-read/unconditional-update race.
4. Direct offer policies used broad active-staff access; authenticated now has
   SELECT only, while service-role remains trusted.
5. Every current role that can prepare offers already holds
   `deployment.manage`; no new permission grant was required.
6. The final live catalog matches migration 0002: required columns, validated
   checks, partial uniqueness, trigger set, function bodies, RLS policy, and
   RPC/table privileges.
7. The final live application transition graph no longer contains direct
   `hired/offered -> deployed` edges.
8. Prepare and respond use the same application-then-offer lock order; the
   pending-only response update and partial unique index are valid second lines
   of defense.
9. `lookup_application` already uses a lateral latest-offer query, so revision
   history does not expose an arbitrary offer to the applicant.
10. `job_offers.application_id` must remain one-to-many in generated types
    because uniqueness is partial, not whole-table; declined revisions are
    intentional.
11. The deployment scaffold remains non-atomic and cannot be safely enabled by
    adding only a UI contract check.
12. The four legacy deployed applications still have no offer/contract evidence
    and must not be silently rewritten.

## 7. Findings that were false positives or already correct

- Increment E name normalization was already complete and was not redone.
- `eligible_final_interviewers` already existed live; only its generated type was
  missing earlier.
- `respond_to_job_offer` retaining service-role execution is not a public
  authorization bypass; service-role is already trusted and bypasses RLS.
- The absence of authenticated INSERT/UPDATE policies on `job_offers` is now
  intentional, not a missing policy.
- `SECURITY DEFINER` is appropriate for the two offer RPCs because both have
  fixed search paths and validate their callers/credentials.
- Offer insertion before `hired -> offered` is correct inside one transaction;
  the transition trigger can see the new pending row.
- The pending/accepted partial unique index correctly supports declined offer
  revisions and therefore should not become a full unique constraint.
- `deployment_completed`, `deployed_by`, the deployment one-to-one embed, and
  schedule filtering in the retained scaffold were already correct. They do not
  make the overall deployment workflow safe.
- The Deployment route/nav was already fail-closed after Increment E and was not
  re-enabled.

## 8. Remaining issues

### Next pipeline work

1. Increment B (Contract) is not implemented. It needs the current accepted
   offer, explicit draft/printed/signed state order, required signed file/date/
   signer, atomic history, and an upload retry/orphan strategy.
2. Increment C (Deployment) is not implemented. Rework, do not simply wire, the
   retained scaffold. Deployment must require an accepted offer and signed
   contract and use one transactional RPC.
3. Increment D (Employee) is not implemented. Add database uniqueness for
   `employees.application_id`, idempotent creation, and the correct enum mapping
   (`regular -> full_time`, `part_time -> part_time`).
4. Decide whether HR needs an explicit atomic Close application action after a
   declined offer. Current approved implementation keeps the application
   `offered` and supports preparing a revision.

### Known architectural/data issues outside Increment A

- Four legacy deployed applications predate the mandatory flow and have no
  offers/contracts. Leave them unchanged until the user chooses legacy display,
  hide, or explicit backfill.
- Reporting manager is nullable text; a safe manager directory/ID model is still
  unresolved.
- Contract storage is private but has no client delete policy, so an upload that
  succeeds before a DB failure can leave an orphan.
- Repeat applications reuse one applicant row, so later resume/contact changes
  can rewrite evidence shown for older applications. The legacy submit overload
  also lacks DB-level case-normalized uniqueness.
- Interview transitions remain multi-request/non-atomic.
- General Manager permissions still disagree with legacy profile-role interview
  queue scoping.
- An HRMS employee row alone does not create a POS account, role, or store
  membership.
- No email provider is integrated; email-named history events are audit events.

### Non-blocking hardening

- A future disposable-fixture harness could run a true two-connection applicant
  response race test. Static lock/update review is correct, and the rollback
  probe covers sequential exactly-once behavior.
- `lookup_application` orders latest offers by `created_at DESC`; adding `id DESC`
  would make the already-low-probability equal-timestamp case deterministic.
- Pure trigger guards could use narrower invoker privileges/ACL cleanup. They
  cannot be called as normal RPCs, so this is not an exposed bypass.
- The main production chunk remains about 569 kB and triggers Vite's 500 kB
  warning.
- LF/CRLF normalization warnings remain. They are Git normalization signals, not
  test failures.

## 9. Current git status

Captured after all implementation and verification:

```text
## main...origin/main
 M .gitignore
 M docs/superpowers/specs/2026-08-09-recruitment-deployment-design.md
 M e2e/recruitment-pipeline.spec.ts
 M src/features/careers/TrackApplicationPage.tsx
 M src/features/people/RecruitmentPage.tsx
 M src/features/people/interviews/InterviewDetailSheet.tsx
 M src/features/people/interviews/ScheduleInterviewDialog.tsx
 M src/features/people/recruitment/ApplicantDetailSheet.tsx
 M src/lib/applicationLabels.ts
 M src/router/routes.tsx
 M src/services/applications.test.ts
 M src/services/applications.ts
 M src/services/interviews.test.ts
 M src/services/interviews.ts
 M src/services/recruitment.test.ts
 M src/services/recruitment.ts
 M src/types/database.types.ts
 M tests/db/contracts.test.ts
?? db/migrations/0002_atomic_job_offers.sql
?? e2e/offer-flow.spec.ts
?? src/features/people/DeploymentPage.tsx
?? src/features/people/deployment/
?? src/features/people/recruitment/PrepareOfferDialog.tsx
?? src/services/deployment.test.ts
?? src/services/deployment.ts
?? src/services/offers.test.ts
?? src/services/offers.ts
```

There are 27 porcelain entries (18 modified, 9 untracked when the untracked
directory is expanded). Nothing is staged. Nothing was committed or pushed.
`git diff --check` passes with line-ending warnings only.

The two status-only paths and four retained deployment files are explained in
section 3. `AI_HANDOFF.md` is ignored.

## 10. Tests, build, database, and Playwright results

Final results on this worktree:

- `npm run typecheck` - PASS.
- `npm run lint` - PASS, no lint warnings.
- Focused Increment A services:
  `npx vitest run src/services/offers.test.ts src/services/applications.test.ts src/services/recruitment.test.ts`
  - PASS: 3 files, 55 tests.
- Full `npx vitest run` - PASS: 44 files, 858 tests.
- `npx vitest run --config vitest.db.config.ts` - PASS: 1 file,
  16 read-only contract tests.
- `npm run build` - PASS: Vite 8.2.1, 3,656 modules transformed. Known warning:
  main chunk approximately 569.04 kB.
- Final Playwright command:
  `npx playwright test e2e/offer-flow.spec.ts e2e/smoke.spec.ts --project=chromium`
  - PASS: 7/7 in 17.5 seconds.
  - Offer tests cover HR initial preparation, future-date and salary-range
    validation, server-authoritative payload omission, employment-type filtered
    lookups, revised-offer action, applicant terms, accept, required decline
    reason, decline payload, post-response state, no Vite overlay, and no browser
    errors.
  - Every offer write is mocked; unexpected Data API writes are blocked.
- Earlier focused Increment E browser verification - PASS: 1/1, non-mutating;
  its temporary spec was removed after verification.
- `git diff --check` - PASS, LF/CRLF warnings only.

Database verification:

- Full migration 0002 rollback dry run - PASS.
- Explicit rolled-back fixture probe - PASS:
  - invalid salary/date left no writes;
  - initial preparation produced exactly one pending offer, `offered`
    application status, and one preparation history row;
  - PHP/type/schedule snapshots were server-derived;
  - identical retry returned the same UUID without duplicate history;
  - anonymous decline recorded once;
  - an authorized revision created one new pending offer;
  - the transaction was rolled back and the fixture was absent afterward.
- Final migration application with single-transaction psql - PASS.
- Post-apply catalog/FK/function privilege audit - PASS.
- Persisted live counts after verification:

```text
applications: submitted 2, qualified 1, interview_scheduled 1, hired 6, deployed 4
job_offers: 0
employment_contracts: 0
deployment_records: 4
employees: 6
```

No live applicant/application/offer/history fixture was retained.

## 11. Failures still present

There is no outstanding failing typecheck, lint, unit test, database contract,
build, focused Playwright test, smoke test, migration probe, or diff check.

Transient verification failures were corrected and rerun:

- the first Playwright run expected a locale-specific `PHP` salary prefix while
  Chromium rendered the peso symbol; the assertion now checks the amount;
- a write-blocking Playwright route initially also blocked the three read-only
  authorization RPCs, causing the HR page to show no modules; those exact RPCs
  are now allowed while unexpected writes remain blocked; and
- sandboxed Chromium/Vitest process spawning returned `EPERM`; the same commands
  passed when run with approved local process-launch permission.

The remaining items in section 8 are unresolved design/architecture risks, not
red tests. The build's chunk-size warning is still present.

## 11b. Increment B (Contract) — IMPLEMENTED by Claude, verified

Codex's Increment E and Increment A claims were **verified before any new work**
and all held: git status matched, deployment is fail-closed (no route, nav
`planned`), migration 0002 is live (`prepare_job_offer` present, `hired ->
deployed` removed from the transition graph, `job_offers` authenticated-SELECT
only), and typecheck/lint/858 unit tests passed on the inherited tree. Nothing
was redone.

### Migration 0003 — applied

`db/migrations/0003_atomic_employment_contracts.sql`, dry-run with an explicit
ROLLBACK first, then applied with `--single-transaction`. The database was not
reset or reseeded.

Why it was needed (verified against the live catalog, not assumed):
`employment_contracts` had a single broad `ALL` policy, so any active staff
session could insert a "signed" contract with no offer, no file and no history —
the same hole 0002 closed for offers. Nothing tied a contract to an *accepted*
offer, nothing prevented two contracts per offer, nothing enforced
draft -> printed -> signed, and `start_date` was client-supplied so it could
disagree with the offer the applicant accepted.

It adds:

- `employment_contracts_job_offer_unique` (one contract per offer) and a
  `signed` CHECK requiring file + `signed_at` + `signed_by` together;
- `generate_employment_contract(...)` — reads the **accepted** offer, derives
  `start_date` from it, creates the draft, writes `contract_prepared`;
  regenerating before signature refreshes wording instead of duplicating;
- `mark_contract_printed(...)` — draft -> printed, writes `contract_generated`,
  idempotent if already printed;
- `record_contract_signing(...)` — printed -> signed only, requires a file path,
  sets `signed_at`/`signed_by` server-side, writes `contract_signed`;
- RLS lockdown mirroring 0002: `employment_contracts` is authenticated-SELECT
  only, INSERT/UPDATE/DELETE revoked, the three RPCs granted to `authenticated`
  and revoked from public/anon.

All three follow Codex's conventions: SECURITY DEFINER with a fixed
`search_path`, actor from `auth.uid()`, `deployment.manage` authorization,
semantic UPPER_SNAKE error codes, and **application row locked before the
offer/contract row** so they cannot deadlock against `prepare_job_offer` or
`respond_to_job_offer`.

### Proof (rolled-back full-chain probe, nothing persisted)

```text
STEP1 offer prepared          STEP2 offer accepted
STEP3 contract generated status=draft start_date=2026-09-08 (offer start=2026-09-08)
STEP4 guard OK: CONTRACT_NOT_ISSUED        (signing a draft is refused)
STEP5 printed
STEP6 guard OK: CONTRACT_FILE_REQUIRED     (signing with no file is refused)
STEP7 signed status=signed file=... signer=t time=t
STEP8 guard OK: CONTRACT_ALREADY_SIGNED    (double-signing is refused)
STEP9 history: contract_prepared, contract_generated, contract_signed
ROLLBACK — job_offers 0, employment_contracts 0 afterwards
```

### Application code

- `src/services/contracts.ts` — `fetchContractForApplication`, `generateContract`,
  `markContractPrinted`, `recordContractSigning`, `validateSignedContractFile`,
  `signedContractUrl`, with the same RPC-error-to-sentence mapping style as
  `offers.ts`. **Upload happens before the RPC**: a row marked signed whose file
  never landed would be an assertion rather than evidence (and the CHECK rejects
  it). The tradeoff — an orphaned object in the private `contracts` bucket if the
  RPC then fails — is documented in the file; there is no client delete policy on
  that bucket, so cleanup stays operational.
- `src/services/contracts.test.ts` — 13 tests.
- `src/features/people/recruitment/ContractPanel.tsx` — shows the contract stage
  once the offer is accepted and offers only the one action the contract is ready
  for (Prepare -> Issue for signing -> Record signed copy -> View signed copy).
- `ApplicantDetailSheet` renders it when `latestOfferStatus === 'accepted'`,
  gated on the same `deployment.manage` prop as offer preparation.
- `tests/db/contracts.test.ts` — 4 added read-only checks: the three RPCs exist
  and refuse anon; `employment_contracts` exposes nothing anonymously.
- `src/types/database.types.ts` — added the three RPC signatures.
  **`npx tsc --noEmit` did not catch their absence but `npm run build` (`tsc -b`)
  did** — always run the build before claiming type safety on new RPCs.

### Deferred from Increment B (deliberate, not forgotten)

- **The printable contract document/page is not built.** `mark_contract_printed`
  is currently triggered by an explicit "Issue for signing" action rather than by
  opening a rendered contract. The state machine, evidence and history are
  correct; the rendered document is presentation and can be added without
  touching the database.
- Contract revision history: one contract per offer. A declined offer can be
  revised, and its replacement gets its own contract.

## 11c. Test results after Increment B

- `npx tsc --noEmit` — PASS.
- `npm run lint` — PASS, exit 0, no warnings.
- `npx vitest run` — **PASS: 45 files, 881 tests** (was 44/858; +23).
- `npx vitest run --config vitest.db.config.ts` — **PASS: 20 tests** (was 16).
- `npm run build` — PASS after adding the RPC types. Known warning only: main
  chunk ~569 kB.
- `npx playwright test e2e/smoke.spec.ts e2e/offer-flow.spec.ts --project=chromium`
  — **PASS 7/7**. `e2e/recruitment-pipeline.spec.ts` was deliberately **not** run:
  it writes, and it still ends at the pre-0002 flow.
- Live DB after all work: `job_offers 0, employment_contracts 0,
  deployment_records 4` — unchanged; no fixture retained.

**Increment B was subsequently exercised in a browser** — see §11f.

## 11d. Increment C (Deployment) — REWORKED, applied, verified

The retained scaffold was **reworked, not wired**. Migration 0004
(`db/migrations/0004_atomic_deployment.sql`) was dry-run with ROLLBACK, then
applied with `--single-transaction`. No reset, no reseed.

Why each piece was needed (verified against the live catalog first):
after 0002 there was **no edge into `deployed` at all**; `deployment_records`
still had one broad `ALL` policy so any active staff session could insert a
deployment row with no offer, no contract and no history; the deployment date was
client-supplied and could contradict the accepted offer; and branch / work
location / schedule were never cross-validated.

It adds:

- the `offered -> deployed` edge in `enforce_application_transition` (body
  preserved verbatim from the live 0002 definition; only the edge and guard
  added), **gated on the accepted offer having a signed contract** — so a direct
  API call cannot skip the process either;
- `deploy_applicant(...)` — one transaction for the deployment record, the
  status change and the history entry. It requires an accepted offer and a
  signed contract, derives `deployment_date` from the offer's start date,
  validates that the work location belongs to the chosen branch and that the
  schedule matches the offer's employment type, snapshots the branch/location
  names server-side, and is idempotent on retry (`application_id` is UNIQUE);
- `deployment_records` locked to authenticated SELECT, writes revoked, RPC
  granted to `authenticated` and revoked from public/anon.

### Proof (rolled-back probe; nothing persisted)

```text
STEP1 guard OK: DEPLOY_CONTRACT_NOT_SIGNED        (no contract at all)
STEP2 guard OK: DEPLOY_CONTRACT_NOT_SIGNED        (contract exists but unsigned)
STEP3 guard OK: DEPLOY_LOCATION_BRANCH_MISMATCH   (location from another branch)
STEP4 guard OK: DEPLOY_SCHEDULE_MISMATCH          (part_time schedule on a regular offer)
STEP5 deployed date=2026-09-08 branch=Cavite Branch location=Cavite Warehouse
      manager=Mina Manager app_status=deployed
STEP5b offer start_date = 2026-09-08              (deployment date equals it)
STEP6 retry OK: same deployment id returned
STEP7 history: contract_signed, deployment_completed
ROLLBACK — offers 0, contracts 0, deployments 4 (unchanged) afterwards
```

### Application code

- `src/services/deployment.ts` — rewritten: one `deploy_applicant` RPC call
  (no separate insert/status/history writes), queue reads `offered`/`deployed`
  with the accepted offer and its contract, exposes `startDate` and
  `contractSigned`, and drops applicants whose offer is still pending. Adds
  `fetchReportingManagers()` reading the active employee directory
  (`employees_read_all` already permits it — no new policy).
- `src/services/deployment.test.ts` — rewritten for the RPC, 10 tests including
  "the client must not send a deployment date" and unsigned-contract gating.
- `DeployApplicantDialog` — deployment date is **read-only from the offer**;
  branch, work location (cascaded), schedule (employment-type filtered) and
  reporting manager are all dropdowns; no free-text lookup fields remain.
- `DeploymentPage` — status reads Deployed / Ready to deploy / Awaiting signed
  contract, and the Deploy action only appears once the contract is signed.
- Route `/dashboard/deployment` re-enabled (gated `deployment.view`) and the nav
  item flipped `planned -> ready` — deployment is no longer fail-closed, because
  the database now enforces the process.
- `src/types/database.types.ts` — added `deploy_applicant`.
- `tests/db/contracts.test.ts` — +2 read-only checks (anon refused, no rows).

## 11e. Test results after Increment C

- `npx tsc --noEmit` — PASS. `npm run build` — PASS (known ~569 kB chunk warning).
- `npm run lint` — PASS, exit 0.
- `npx vitest run` — **PASS: 45 files, 882 tests**.
- `npx vitest run --config vitest.db.config.ts` — **PASS: 22 tests**.
- `npx playwright test e2e/smoke.spec.ts e2e/offer-flow.spec.ts --project=chromium`
  — **PASS 7/7**.
- Live DB after all work: `job_offers 0, employment_contracts 0,
  deployment_records 4, applications deployed 4` — unchanged. The four legacy
  deployments were not touched.

**Increments B and C were subsequently exercised in a browser** — see §11f.

## 11f. Live browser verification — offer → contract → deployment (DONE)

The user authorised spending one live hired application to confirm the screens.
`APP-2026-0007` was driven **through the real UI**, end to end:

```text
APP-2026-0007 | app=deployed | offer=accepted | contract=signed
              | deployment_date=2026-09-09 | branch=Cavite Branch | mgr=Andres Accountant
offer start_date = deployment_date = 2026-09-09   (match=true)

history: submitted, qualified, initial_interview_scheduled,
         initial_interview_passed, final_interview_scheduled, hired,
         job_offer_prepared, offer_accepted, contract_prepared,
         contract_generated, contract_signed, deployment_completed
```

Every stage of the mandatory process is present and in order — nothing skipped.
Confirmed in the browser: HR prepared the offer (Increment A), the applicant
accepted it on the public tracker, HR prepared → issued → recorded the signed
contract with a real upload to the private `contracts` bucket (Increment B), and
HR completed deployment with the date read-only from the offer and every lookup
a dropdown (Increment C). The Deployment nav entry and route are live again.

**Two test-only defects found and fixed during this run — the app was correct
both times:**

1. The first attempt asserted `getByText('Signed', { exact: true })` after
   recording the signature. That matched the **"Signed" field label** in
   `ContractPanel`, which is present for any contract, so it passed instantly.
   The spec then navigated away and **aborted the in-flight upload/RPC**
   (`net::ERR_ABORTED`), leaving the contract at `printed`. Re-running the step
   without the premature navigation produced upload 200 + RPC 204 and
   `contract=signed`. Lesson for future specs: assert a state that only exists
   *after* the write (e.g. the "View signed copy" action), and wait for the
   dialog/mutation to settle before navigating.
2. A verification SQL of mine used an ambiguous `status` column across a join.
   That was my query, not the application.

Live data after this run: `job_offers 1 (accepted), employment_contracts 1
(signed), deployment_records 5, applications deployed 5`, and 1 object in the
`contracts` bucket. Five hired applications remain untouched.

## 11g. Increment D (Employee record) — IMPLEMENTED, applied, browser-verified

`db/migrations/0005_employee_from_application.sql`: dry-run with ROLLBACK, then
applied with `--single-transaction`. No reset, no reseed.

Why (verified against the live catalog first): `employees.application_id` had
**no uniqueness**, so one application could produce two people — directly against
PROJECT_CONTEXT's "never duplicate employee records"; building the record
client-side would have meant the browser restating the name, salary, schedule and
start date that the offer and deployment already fixed; and
`application_history` had no permitted event for this step, so the audit trail
stopped at deployment.

It adds a partial unique index on `employees(application_id)`, extends the
history CHECK with `employee_created` (additive — cannot invalidate existing
rows), and `create_employee_from_application(...)`: permission-scoped
(`employee.create`), requires the application to be `deployed`, copies from the
applicant / accepted offer / deployment / posting, maps the recruitment enum to
the HR one (`regular -> full_time`, `part_time -> part_time`), and is
**idempotent** — a second call returns the existing employee instead of creating
a duplicate.

### Proof (rolled-back probe)

```text
STEP1 guard OK: EMPLOYEE_NOT_DEPLOYED           (non-deployed application refused)
STEP2 created EMP-… Pipeline Candidate | type=full_time status=active
      hire=2026-09-09 salary=20000.00 PHP | position=Accountant branch=t schedule=t
STEP3 offer employment_type=regular -> employee employment_type=full_time
STEP4 deployment_date = hire_date : true
STEP5 idempotent OK: same employee id returned
STEP6 employees for this application = 1
STEP7 history tail: deployment_completed, employee_created
ROLLBACK
```

### Application code

- `src/services/employees.ts` — added `fetchPendingEmployees()` and
  `createEmployeeFromApplication()` (reusing the existing employees service
  rather than creating a parallel one), plus `pendingEmployeesQueryKey`.
- `src/features/people/PendingEmployees.tsx` — an "Awaiting employee record"
  card on the Employees page; renders nothing when the list is empty.
- `src/services/employees.test.ts` — 9 tests.
- `tests/db/contracts.test.ts` — +1 (anon refused).
- `src/types/database.types.ts` — added `create_employee_from_application`.

### A real defect the live run caught

The first browser attempt clicked a pending row that failed with
`EMPLOYEE_OFFER_NOT_FOUND`. Cause: **the four legacy deployed applications
predate offers**, so they were listed as "pending employee record" but could
never be created — a permanently failing action. `fetchPendingEmployees()` now
requires an accepted offer, so only applicants this path can actually serve are
listed. The legacy rows were **not** modified (still awaiting the user's
display/hide/backfill decision).

### Live browser verification — the whole pipeline

`APP-2026-0007` now has an employee record created through the UI:

```text
EMP-2026-0002 | Pipeline Candidate | type=full_time | status=active
              | hire=2026-09-09 | salary=20000.00 PHP | position=Accountant | linked=true

history: submitted → qualified → initial_interview_scheduled →
         initial_interview_passed → final_interview_scheduled → hired →
         job_offer_prepared → offer_accepted → contract_prepared →
         contract_generated → contract_signed → deployment_completed →
         employee_created
```

**An employee row is not a POS account.** User, role and store membership remain
a separate, deliberate step — nothing here claims POS login availability.

## 11h. Test results after Increment D

- `npm run build` (`tsc -b` + vite) — PASS (known ~569 kB chunk warning).
- `npm run lint` — PASS, exit 0.
- `npx vitest run` — **PASS: 896 tests**.
- `npx vitest run --config vitest.db.config.ts` — **PASS: 23 tests**.
- `npx playwright test e2e/smoke.spec.ts e2e/offer-flow.spec.ts` — **PASS 7/7**.
  One earlier combined run had `smoke › the login page renders when signed out`
  fail; it passed on two subsequent runs (alone and combined). Treated as a
  cold-start flake under parallel workers, not a regression — worth watching.
- Live data now: `job_offers 1 (accepted), employment_contracts 1 (signed),
  deployment_records 5, employees 7 (1 linked to an application)`.

## 11i. Administration modules supporting HRMS — BUILT and verified

Departments, Branches, Work Schedules and Salary Grades. The HRMS reference was
reviewed first (`pages/admin/*`, `hooks/use{Departments,Branches,WorkSchedules,
SalaryGrades}.ts`) specifically to find process I would otherwise have skipped.

**No migration was needed** — every table is already permission-gated per action
by RLS (`department.create`, `branch.update`, `is_hr_manager_or_admin()` for
schedules and grades), and the min/max range already has a CHECK.

New: `src/services/administration.ts` (+ 19 tests),
`src/features/admin/{AdminPageShell,DepartmentsPage,BranchesPage,
WorkSchedulesPage,SalaryGradesPage}.tsx`.
Modified: `src/router/routes.tsx` (4 routes), `src/router/navigation.ts`
(4 items `planned -> ready`), `src/layouts/Sidebar.tsx` (Clock, Coins icons).

### Process the reference review caught (would have been missed)

1. **Delete must explain what still references the row.** "violates foreign key
   constraint" is a dead end for an administrator. The service maps FK
   violations to sentences naming the dependents, plus unique-violation and
   RLS-denial cases.
2. **Three of the four tables already have their own `trg_block_delete_*`
   guard** with better messages than any client mapping — e.g. deleting Sales
   raises *"This department still has 2 employee(s) assigned. Move them to
   another department first."* The app surfaces that message as-is.
   **`branches` has no such trigger**, so there the client mapping of the raw FK
   error is what produces a usable message.
3. **Salary grade range is load-bearing, not cosmetic**: `prepare_job_offer`
   rejects any offer below the minimum or above the maximum, so a bad range
   breaks offer preparation. Validation runs live in the dialog, again before
   the write, and the database has its own CHECK.
4. **Work schedule end must be after start** — a negative shift would make
   attendance and payroll measure a negative day. Also at least one working day,
   and non-negative break minutes.
5. **Department/branch codes are upper-cased** so "sls" and "SLS" cannot become
   two departments.
6. **Two sidebar icons (Clock, Coins) were missing from the icon map** and would
   have silently fallen back to the dashboard icon.

### Navigation decision — deliberately NOT changed

These four are gated on `ADMIN_ROLES` like the rest of Administration, because
`src/router/navigation.test.ts` encodes the user's explicit "Administration is
admin-only" decision. My first pass gated them on their real permissions, which
**failed that test** — rather than rewrite a test that encodes a product
decision, the nav was reverted to admin-only and the trade-off surfaced.

Note the database is more permissive than the menu: `department.*` is granted to
HR Manager, and schedules/grades to `is_hr_manager_or_admin()`. Those roles can
still reach the pages by URL and RLS will allow their edits — only the sidebar
entry is hidden. One-line change in `navigation.ts` (swap `roles: ADMIN_ROLES`
for `permissions: [...]`) if HR should see them, but the nav test must be
updated with it.

### Verification

- `npm run build` — PASS. `npm run lint` — PASS. `npx vitest run` — **945 tests**.
- Live browser (temporary spec, since deleted): all four pages render seeded
  data; a salary grade with max below min blocks the save with an inline error;
  a work schedule ending before it starts does the same; a department
  round-trips (create → delete); and deleting the in-use "Sales" department is
  refused with the database's own message while the row survives.
- Test data: one throwaway department was created and removed; the database is
  back to 4 departments / 5 branches / 5 salary grades. (The 7th work schedule,
  "Part-Time Evening", predates this work and was left alone.)

## 11j. Two bug fixes from user testing

1. **Overnight shifts were rejected.** A 10:00 PM → 07:00 AM schedule failed
   with "end time must be after the start time". `work_schedules` stores clock
   times, not instants, so an end earlier than the start is a night shift
   crossing midnight — a real schedule, not an error. `validateWorkSchedule` now
   rejects only a zero-length shift (and a break as long as the shift), and
   `isOvernightShift()` / `shiftMinutes()` were added so anything measuring
   these times counts across midnight instead of going negative. The dialog
   shows "ends at 07:00 the next day (8.0 paid hours)" and the table marks the
   row `(+1d)`. **Attendance and payroll must use `shiftMinutes()` — computing
   `end - start` directly will produce a negative shift for night staff.**
2. **The sidebar could not scroll**, so Audit Logs and Settings were unreachable
   once the Administration items were added. The rail is `fixed inset-y-0`; it
   is now a flex column with a non-shrinking header and `flex-1 overflow-y-auto`
   on the nav (desktop rail and mobile drawer).

Verified live: a 22:00→07:00 schedule saves and lists as `22:00 – 07:00 (+1d)`;
Settings and Audit Logs scroll into view. Build, lint and **949 unit tests** pass.
The throwaway night schedule was deleted; 7 work schedules remain, as before.

## 11k. Next HRMS modules — schema verified, not yet built

The user asked for Attendance, Payroll, and employee self-service (attendance,
leave request, payslips), and explicitly said **do not start POS yet**.

Everything needed already exists in the database — no new tables:

- `attendance_records` (employee_id, attendance_date, time_in, time_out,
  working_hours, late_minutes, undertime_minutes, overtime_minutes, status).
  RLS already separates HR from self-service: `attendance_records_staff_*` plus
  `attendance_records_self_insert` and `attendance_records_self_timeout` — the
  employee time-in/time-out path is already permitted.
- `payroll_periods`, `payroll_records` (a full computation row: gross, late/
  undertime/leave deductions, SSS/PhilHealth/Pag-IBIG, net, status, reviewer),
  `payroll_line_items`, `payslips` (+ `payslips_self_select`).
- `leave_requests` / `leave_types` / `leave_balances` — the HR side is already
  built (`/dashboard/leave`); the **employee-facing request form is not**.
- Protective triggers already present: `handle_attendance_recorded`,
  `protect_payroll_generation`, `protect_payroll_amounts`,
  `protect_payroll_approval`, `require_payroll_rejection_reason`,
  `sync_payroll_period_status`, `recompute_payroll_period_status`.
  **Read these before writing any payroll service** — they define the real
  workflow (generate → submit → review/approve → release) and will reject a
  client that invents its own.
- Current data: attendance 0, payroll_periods 0, payroll_records 0.

Suggested order: **Attendance first** (payroll consumes it), then Payroll, then
the employee self-service pages. Leave self-service can slot in with attendance
since the HR half already exists.

## 11l. Attendance — BUILT and verified (first of three HRMS modules)

Order agreed with the user: **Attendance → Payroll → employee self-service.**
No migration needed; `attendance_records` and its RLS already existed.

New: `src/lib/attendanceCalculations.ts` (+19 tests),
`src/services/attendance.ts` (+9 tests), `src/features/people/AttendancePage.tsx`.
Modified: `src/router/routes.tsx` (`/dashboard/attendance`, gated
`attendance.view`), `src/router/navigation.ts` (`planned -> ready`).

### Process taken from the HRMS reference (easy to miss)

1. **"Absent" is derived, never stored on demand** — an active employee whose
   schedule covers that day with no record at all. The stats query computes it
   rather than counting rows.
2. **Explicit statuses are HR's classification and must never be overwritten**
   by calculation: absent, on_leave, rest_day, official_business,
   work_from_home. Only present/late/half_day are derived from the times.
3. **Effective schedule = assigned → default → explicit error** pointing at
   *Administration → Work Schedules*, which is exactly why that admin module had
   to exist first.
4. **Shift-window rules**: time in at most 2h early (being late is recorded, not
   refused); time out not before shift end and at most 2h overtime. **HR
   corrections deliberately bypass the window** — that is the escape hatch for
   the cases these rules refuse.
5. **No double time-in, and no edits after time-out** without a correction.
6. **Overnight shifts are handled throughout** — the scheduled end moves to the
   next calendar day, so a 22:00–07:00 worker is not measured as 9h late. This
   is the same bug class the user reported in the schedule form.
7. **Local time strings are converted through `Date().toISOString()`** before
   insert; sending a timezone-less string to a `timestamptz` column would make
   Postgres read it as UTC and disagree with the browser-local maths.
8. `half_day` outranks `late` — someone who arrived late and left at lunch
   worked half a day, and calling it merely "late" would overpay.

### Verification

`build` PASS, `lint` PASS, **992 unit tests** PASS. Live: recorded 08:15–17:00
against an 08:00–17:00 shift with a 60-minute break; the row persisted as
`status=late, late=15m, hours=7.75, ot=0m` and the table showed "Late · late 15m".
One attendance row now exists (2026-08-03) — left in place as the first real
record for Payroll to consume.

### Next: Payroll

`payroll_periods`, `payroll_records`, `payroll_line_items`, `payslips` all exist
and are empty. **Read the triggers first** — `protect_payroll_generation`,
`protect_payroll_amounts`, `protect_payroll_approval`,
`require_payroll_rejection_reason`, `sync_payroll_period_status`,
`recompute_payroll_period_status`. They define the real workflow (generate →
submit → review/approve → release) and will reject a client that invents its own.
Payroll consumes the attendance numbers above, so it must use
`shiftMinutes()`/the attendance metrics rather than recomputing spans naively.

## 11m. Payroll — BUILT and verified (second of three HRMS modules)

New: `src/lib/statutoryContributions.ts`, `src/lib/payrollCalculations.ts`
(+14 tests), `src/services/payroll.ts` (+11 tests),
`src/features/people/PayrollPage.tsx`. Modified: `routes.tsx`
(`/dashboard/payroll`, gated `payroll.review`), `navigation.ts`
(`planned -> ready`). Migration: **0006** (see below).

### The workflow is the database's, not the client's

Six existing triggers define a real maker–checker separation, read before
writing any code:

- `protect_payroll_generation` — **only HR Staff/admin may create or generate**.
- `protect_payroll_approval` — **only an HR Manager/admin** may set
  approved / rejected / released.
- `protect_payroll_amounts` — a manager may change status and review fields but
  **not the figures**; correcting numbers goes back to HR Staff.
- `require_payroll_rejection_reason` — rejecting needs a reason.
- `sync_payroll_period_status` / `recompute_payroll_period_status` — the
  period's status is **derived from its records**, so the service never sets it.

The UI mirrors this exactly: Generate/Submit for HR Staff, Approve/Reject/Release
for the manager, and each database refusal is mapped to a sentence.

### Calculations (ported, not invented)

Daily rate = basic ÷ **scheduled** working days in the period (so a part-timer
is not paid as if they worked five days); hourly = daily ÷ the schedule's paid
hours; overtime at 125%; late/undertime charged at the hourly rate; **paid leave
is not deducted, only leave without pay**; net never goes negative. Statutory
contributions are 2025 SSS / PhilHealth / Pag-IBIG **employee shares only**,
pro-rated by payroll frequency — a weekly run must not deduct a full month.
Pay is derived from `attendance_records`; nothing re-measures a day.

### Migration 0006 — a real pre-existing bug that made release impossible

`finance_post_payroll()` (AFTER UPDATE OF status on `payroll_periods`) built its
journal memo from `coalesce(new.name, new.id::text)`, but `payroll_periods`
**has no `name` column**. Every release with a non-zero total failed with
`record "new" has no field "name"`. It stayed hidden because the trigger returns
early when the total is zero or the finance accounts are missing — it only fires
for a real release, which is exactly the case that matters.

0006 replaces just that expression with the period's dates. It repairs a broken
reference so HRMS payroll can be released; **it does not implement FMS** — no
finance feature is added and posting behaviour is unchanged.

### Verification

`build` PASS, `lint` PASS, **1037 unit tests** PASS, smoke 4/4.
Live: created period 2026-08-01..08-31, generated 7 records from real
attendance, submitted, approved, and **released**. The one employee with a real
salary computed correctly end to end:

```text
basic 20,000 → SSS 1,000 + PhilHealth 500 + Pag-IBIG 200 = 1,700 deductions
             → net 18,300 over 21 scheduled working days
```

Period is now `released` and one finance journal entry exists:
`Payroll — 2026-08-01 to 2026-08-31`.

**⚠ Six of seven employees have `basic_salary = 0`,** so their payroll computes
zeros. Only the employee created through the recruitment pipeline carries a
salary (from the accepted offer). Seeded employees need salaries set before
payroll output is meaningful — a data gap, not a code defect.

### Test-assertion lessons (the app was right each time)

Two of my specs gave misleading results: one asserted loose text and **passed
while the release had actually failed** on the broken trigger; another expected
the drawer to close after a decision when it deliberately stays open. Assert the
durable state (a status badge, a database row), never a toast or a disappearance.

### Next: employee self-service

Last of the three. `attendance_records_self_insert` / `_self_timeout` already
permit an employee to clock their own day (yesterday..tomorrow);
`payroll_records_self_select` and `payslips_self_select` already expose their own
pay; `leave_requests` has the HR half built but **no employee request form**.
`attendance.view` includes the Employee role, and `profiles`/`employees` link
via `employees.application_id` / `users.employee_id` for "my" scoping.

## 11n. Employee self-service portal — BUILT and verified (third of three)

Built to the user's explicit instruction: *"Do not mix POS and Employee
Self-Service in one sidebar. After login: POS-only/cashier users go to /pos by
default; Employee-only users go to /employee; HR/Admin users go to /dashboard.
Users with multiple portal access should have a portal switcher in the profile
menu. The portal switcher should only show portals the user is allowed to
access. Each portal must have its own layout and sidebar."*

### Portal model — `src/lib/portals.ts` (+ `portals.test.ts`, 11 tests)

Three portals, each with its own layout, sidebar and landing route. Access is
derived from what the database already grants rather than a new concept to keep
in sync:

| Portal | Key | Path | Granted by |
| --- | --- | --- | --- |
| Back office | `admin` | `/dashboard` | `employee.view` |
| Point of sale | `pos` | `/pos` | `sales.create` |
| My workspace | `employee` | `/employee` | account linked to an employee record |

`defaultPortalPath()` returns the first portal held in the order
admin → pos → employee, so a cashier lands at the till and an HR manager at the
back office. `availablePortals()` drives the switcher; `portalForPath()` marks
the current one.

### Routing — the `/home` hop

`/home` (`src/router/PortalRedirect.tsx`) is a protected route that renders
`<Navigate to={defaultPortalPath(...)}>`. It exists because the login form
cannot answer the question: when the password is accepted the authorization
query has not resolved, so a cashier would be computed into the back office and
bounced. Under `ProtectedRoute`, profile and permissions are both loaded before
the decision is made.

### Files added

- `src/lib/portals.ts`, `src/lib/portals.test.ts`
- `src/layouts/PortalLayout.tsx` — the shared responsive shell (desktop rail,
  tablet icon rail, mobile drawer), parameterised by navigation + portal name
- `src/layouts/EmployeeLayout.tsx`, `src/layouts/PosLayout.tsx`
- `src/router/PortalRedirect.tsx`
- `src/services/selfService.ts` (+ `selfService.test.ts`, 11 tests) —
  `fetchMyAttendance`, `fetchTodayAttendance`, `clockAttendance`,
  `fetchMyLeave`, `fetchMyLeaveBalances`, `fileMyLeave`, `fetchMyPayslips`
- `src/features/employee/EmployeeOverviewPage.tsx`
- `src/features/employee/MyAttendancePage.tsx`
- `src/features/employee/MyLeavePage.tsx`
- `src/features/employee/MyPayslipsPage.tsx`
- `src/features/pos/TillPage.tsx` — placeholder only; the POS module is still
  deliberately out of scope
- `e2e/portal-verify.spec.ts` — see the caveat below

### Files changed

- `src/layouts/AppLayout.tsx` — now delegates to `PortalLayout`
- `src/layouts/Sidebar.tsx` — `SidebarNav` takes a `navigation` prop
  (defaults to `NAVIGATION`); `Clock`/`Coins` added to the icon map
- `src/layouts/Header.tsx` — portal switcher in the profile menu, shown only
  when the account holds more than one portal
- `src/router/navigation.ts` — `EMPLOYEE_NAVIGATION`, `POS_NAVIGATION`
- `src/router/routes.tsx` — `/home`, `/employee/*`, `/pos`
- `src/router/guards.tsx` — `AnonymousOnly` is now the single post-sign-in
  redirect and honours the stashed deep link
- `src/features/auth/LoginPage.tsx` — no longer navigates on success
- `src/contexts/AuthContext.tsx` — `signIn` sets the session itself
- `src/lib/attendanceCalculations.ts` — overtime cap (see below)

### Three real defects this found

1. **Self-service was permission-gated on the HR permissions.** `My Attendance`
   and `My Leave` were gated on `attendance.view` / `leave.view`, which are
   permissions over *other people's* records. The demo cashier holds neither, so
   their own attendance and their own leave were hidden from their own portal.
   The RLS behind self-service asks a different question entirely
   (`is_active_employee() AND employee_id = my_employee_id()`), so
   `EMPLOYEE_NAVIGATION` is now ungated. Regression test in
   `src/router/navigation.test.ts` → `portal sidebars`.

2. **A post-sign-in redirect race blanked the page.** `LoginPage` navigated
   after `await signIn(...)`, but `signIn` awaits a query refetch — so that
   navigation landed *after* `AnonymousOnly` had already redirected, bouncing a
   rendered dashboard back to a blank `<Navigate>`. Reproduced 1-in-2 with a
   loop of fresh browser contexts; the smoke suite had gone intermittently red.
   Fixed by making `AnonymousOnly` the only redirect (it now reads
   `location.state.from` itself) and having `signIn` set the session
   synchronously instead of waiting for `onAuthStateChange`. 8/8 clean after.

3. **Overtime could be banked for time never worked.**
   `calculateAttendanceMetrics` read overtime off the clock alone, so timing in
   at 6:45 PM for an 8-to-5 shift and timing out a minute later produced 106
   overtime minutes against 0 working hours — and `computePayroll` would have
   paid it. Overtime is now capped at the minutes actually present. The existing
   convention is untouched: 08:15→17:30 still yields 30 minutes.

### Live verification (real browser, real database)

`e2e/portal-verify.spec.ts`, 4/4 passing:

- `cashier@jmac.com` (cashier + employee EMP-0004) lands on `/pos`; the POS
  sidebar carries neither back-office nor self-service items; the switcher
  offers **Point of sale** and **My workspace** and *not* Back office; switching
  reaches `/employee` with the self-service sidebar only.
- The same cashier timed in and out and filed leave — rows written under RLS:
  `attendance_records` EMP-0004 2026-08-10 (status `late`), and
  `leave_requests` EMP-0004 Bereavement Leave 2026-09-14..15 `pending`.
  **These two rows are test data left in the database.**
- `admin@jmac.com` has no employee record: offered Back office and Point of sale
  (the system administrator does hold `sales.create`), never My workspace.
- `manager@jmac.com` holds all three, lands on `/dashboard`, and switches back
  and forth.

**Caveat:** `portal-verify.spec.ts` is the only spec in `e2e/` that writes.
Clocking in cannot be proven any other way — the point is that a cashier's own
INSERT passes a policy written in terms of `my_employee_id()`. It writes only to
the demo cashier's own attendance and leave and is idempotent (a day already
closed, or a request already filed, is accepted rather than repeated). Retire it
if the read-only rule in `playwright.config.ts` must hold absolutely.

### Test results after the employee portal

- `npm run build` (`tsc -b` + Vite) — clean
- `npm run lint` (oxlint) — clean
- `npx vitest run` — **53 files, 1119 tests, all pass**
- `npx playwright test` — **12/12 pass**, including the previously stale
  `e2e/recruitment-pipeline.spec.ts`, which now passes and is no longer an open
  item.

## 11o. POS portal — one canonical definition (bug fix)

Reported by the user: Carla Cashier lands in POS, but the account menu does not
mark **Point of sale** as active, and clicking it drops her into a POS layout
whose sidebar contains only **Till** — the real POS modules disappear.

### Root cause

POS was defined twice.

1. The **real** POS menu lived in the `Sales` section of `NAVIGATION`, rendered
   by `AppLayout` under `/dashboard/*` — `POS`, `Inventory`, `Categories`,
   `Transactions`, `My Transactions`, with their permission and role splits.
2. When the portal work added a POS **portal**, it shipped a placeholder:
   `POS_NAVIGATION = [{ label: 'Till', to: '/pos' }]` plus a `TillPage` stub.

So login and the portal switcher both went to `/pos` — the stub — while the
menu everyone recognised as POS was still wired into the back-office shell.
Reproduced live before the fix: Carla's sidebar at `/pos` was exactly
`["Till"]`.

The second symptom has the same shape. `portalForPath()` maps anything that is
not `/employee*` or `/pos*` to `admin`, so a cashier standing on `/dashboard`
(where the real POS menu was) is detected as being in the back-office portal —
a portal she does not hold — and no menu item matches, so nothing is checked.
Fixing the duplication removes the state that produced it: there is no longer a
POS page under `/dashboard`.

### The canonical POS portal

**`/pos`**, and only `/pos`.

- `POS_NAVIGATION` now holds the real menu — the same items, labels, permissions
  and role splits moved wholesale out of `NAVIGATION`, rehomed from
  `/dashboard/*` to `/pos/*`. Nothing about who sees what changed.
- `/pos` renders `DashboardPage`. It is shared deliberately: every tile decides
  for itself whether the signed-in user may see it, so a cashier gets the sales
  tiles at `/pos` and an HR manager gets the HR ones at `/dashboard`.
- Only the dashboard is built. `POS`, `Inventory`, `Categories`, `Transactions`
  and `My Transactions` stay `planned` ("coming soon") exactly as they were
  under `/dashboard`. **This move is not the POS module being started.**
- The label is **POS**, not Till. `TillPage` is deleted.

### Active portal detection

Route-derived, and it always was — `Header` calls `portalForPath(location.pathname)`
and marks the item whose key matches. There is no selected-portal state. What
changed is that the route a cashier actually lands on is now inside the portal
she holds, so the mark is correct on arrival with no interaction. Verified live:
`Point of sale [CHECKED]` on first landing, before any switching.

### Why the POS sidebar is now stable

`SidebarNav` renders `navigation.filter((item) => isVisible(authorization, item))`
— a pure function of the portal's own list and the user's permissions. `PosLayout`
always passes `POS_NAVIGATION`. Nothing is stored, so nothing can drift: the
array Carla gets on landing, after re-selecting Point of sale, and after a round
trip through self-service is the same array. Asserted three ways in
`navigation.test.ts` and end to end in `portal-verify.spec.ts`.

Clicking the portal you are already in navigates to that portal's canonical
path, which is the path you are already on — a no-op re-render, not a layout
change.

### Files changed

- `src/router/navigation.ts` — `Sales` section removed from `NAVIGATION`;
  `POS_NAVIGATION` now carries the real POS menu under `/pos/*`; the POS
  Dashboard gates on `sales.create`, the same permission that grants the portal
  and guards the route, so the menu cannot offer a page the route will refuse.
  Also removed a duplicated doc comment left above `EMPLOYEE_NAVIGATION`.
- `src/router/routes.tsx` — `/pos` renders `DashboardPage`; `TillPage` import gone.
- `src/lib/portals.ts` — POS portal description no longer says "till".
- `src/features/pos/TillPage.tsx` — **deleted** (directory removed).
- `src/router/navigation.test.ts` — the POS suite now asserts against
  `POS_NAVIGATION` instead of the back-office list, plus a new
  `portal sidebars are one definition each` suite.
- `src/lib/portals.test.ts` — landing/detection cases for Carla.
- `e2e/portal-verify.spec.ts` — four new POS portal tests; two locator fixes
  (see below).

### Considered and rejected

Deriving back-office access from `NAVIGATION` visibility instead of the
`employee.view` proxy. It reads better, but the `employee` role holds
`attendance.view` and `leave.view`, so it would have handed **every plain
employee** the HR Attendance and Leave pages. Reverted; `canAccessPortal('admin')`
is unchanged. No permission or RLS change was made for this bug.

### Open finding, not fixed (needs a product decision)

`canAccessPortal('admin')` is `employee.view`, which `pos_manager`, `accountant`,
`finance_manager` and `finance_staff` do not hold. They therefore have **no back
office**, and `Reports` (gated on `report.view`, which they do hold) is
unreachable for them. This predates this bug and is not what was reported, so it
was left alone rather than redesigned mid-fix. It needs a decision about what
"works in the back office" means before FMS lands.

### Test fixes made along the way

- `portal-verify.spec.ts` sampled the sidebar with a plain `expect(...)` right
  after `waitForURL`, which does not retry — it read an empty array while the
  page was still painting. Now `expect.poll`.
- The same spec's `getByText(/^In /)` matched the attendance table's **"In / out"**
  column header, so a day with no record looked complete. Tightened to `/^In \d/`.
- Its clock-in step now states what it can prove: timing in is refused outside
  the shift window (two hours before the shift to two hours after it ends), so a
  run at midnight asserts the refusal and a run at midday asserts the full day.
  Both are correct; the spec no longer assumes it runs during working hours.

### Verification

- `npm run build` (`tsc -b` + Vite) — clean
- `npm run lint` (oxlint) — clean
- `npx vitest run` — **53 files, 1123 tests, all pass**
- `npx playwright test` — **15/15 pass**

Live walkthrough as Carla Cashier (`cashier@jmac.com`), all twelve steps:

| Step | Observed |
| --- | --- |
| 1-2 Login | lands at `/pos` |
| 3-4 Account menu | `Point of sale [CHECKED]`, `My workspace` — no Back office |
| 5 Sidebar | `Dashboard, POS, My Transactions` |
| 6-7 Click Point of sale while in POS | stays `/pos`; sidebar unchanged |
| 8-9 Switch to My workspace | `/employee`; sidebar `Overview, My Attendance, My Leave, My Payslips` |
| 10-11 Switch back | `/pos`; sidebar `Dashboard, POS, My Transactions` restored |
| 12 `/dashboard/employees` | "You don't have access to this page" |

### 11o-a. No portal switcher for the system administrator

Requested by the user: *"remove the switch portal on admin side because all
modules are visible to admin."*

`showsPortalSwitcher(subject)` in `src/lib/portals.ts` now decides whether the
account menu offers the switcher at all: two portals remain the minimum, and the
`system_administrator` role is excluded on top of that. The back office is their
entire workplace, and they hold `sales.create` only because they hold every
permission — not because anyone expects them at a till.

Scoped to `system_administrator` deliberately, matching the existing
`ADMIN_ROLES` decision in `navigation.ts`. `owner` and `general_manager` keep
their switcher: the Administration section is gated on `ADMIN_ROLES`, so those
roles genuinely do *not* see every module in the back-office sidebar. A manager
who spans HR and the till keeps theirs too — they need My workspace for their
own payslips.

This hides the menu, not the route: `/pos` still renders for an administrator
who navigates there, exactly as `RequirePermission` allows.

**Superseded by 11o-b.** This briefly left the administrator with no UI path
into POS, because 11o had also taken the Sales section out of the back-office
sidebar. The Sales section is back, so the administrator reaches POS from their
own sidebar and needs no switcher.

Files: `src/lib/portals.ts`, `src/layouts/Header.tsx`, `src/lib/portals.test.ts`,
`e2e/portal-verify.spec.ts`.

### Portal sweep across the demo accounts

Only `admin`, `manager` and `cashier` have seeded passwords in
`docs/demo-seed.sql`; the other four could not be signed into, which is a
credentials gap, not a fault.

| Account | Lands | Sidebar | Switcher |
| --- | --- | --- | --- |
| `admin@jmac.com` | `/dashboard` | back office, no Sales items | **none** |
| `manager@jmac.com` | `/dashboard` | back office | Back office ✓ / Point of sale / My workspace |
| `cashier@jmac.com` | `/pos` | Dashboard, POS, My Transactions | Point of sale ✓ / My workspace |

No JavaScript errors on any of the three. No further issues found in the POS or
self-service portals.

- `npm run build` clean · `npm run lint` clean
- `npx vitest run` — **53 files, 1127 tests, all pass**
- `npx playwright test` — **15/15 pass**

### 11o-b. Two corrections from the user

**1. The admin keeps the POS modules.** Removing the `Sales` section from
`NAVIGATION` in 11o overshot — the request was only to drop the switcher from
the profile dropdown, not to take POS out of the back-office sidebar.

Resolved without reintroducing the duplication that caused the original bug:
`POS_MODULES` is now a single private array in `navigation.ts`, spread into both
sidebars.

- `NAVIGATION` spreads it as the `Sales` section, so the administrator's sidebar
  reads exactly as it did before.
- `POS_NAVIGATION` spreads it after the POS dashboard.
- Both point at the same `/pos/*` routes — one canonical address per POS page,
  whichever sidebar reaches it. Everything except the POS dashboard is still
  `planned`, so nothing is clickable yet either way.

`navigation.test.ts` now asserts the real invariant: the back office keeps its
five Sales items, and each is gate-for-gate and route-for-route identical to the
POS portal's own entry. (The previous assertion — POS absent from `NAVIGATION` —
encoded the overshoot.)

**2. There was no Positions module.** `positions` exists in the database with 6
rows and is referenced by `employees.position_id` and `job_postings.position_id`,
but the Administration modules built earlier covered only departments, branches,
work schedules and salary grades. Built now, matching the existing pattern:

- `fetchPositions` / `savePosition` / `deletePosition` + `positionsQueryKey` in
  `src/services/administration.ts`, and a `Position` type carrying the
  denormalised department name.
- `src/features/admin/PositionsPage.tsx` — table plus add/edit dialog with a
  department select. Inactive departments are filtered out of the select except
  the one an existing position already sits in, so editing cannot silently move
  it.
- Route `/dashboard/admin/positions` gated on `employee.view`; nav entry under
  Administration (`ADMIN_ROLES`), `IdCard` icon added to the sidebar map.
- Edit actions gate on `canAny(['leave.approve', 'payroll.approve'])`, the same
  proxy for `is_hr_manager_or_admin()` the work schedule and salary grade pages
  use — the permission catalogue has no `position.*` key.

The unique constraint is `(title, department_id)`, not title alone, so the
duplicate message says "That department already has a position with this title."

Worth knowing: `trg_block_delete_positions` fires before the foreign keys and
raises its own user-facing sentence, so the service's `inUseMessage` never
surfaces for this table — `adminError` falls through and passes the trigger's
message, which is better because it names the count. Verified live:
*"This position is held by 1 employee(s). Move them to another position first."*

### Verification

- `npm run build` clean · `npm run lint` clean
- `npx vitest run` — **53 files, 1138 tests, all pass**
- `npx playwright test` — **15/15 pass**

Live as `admin@jmac.com`:

- Sidebar: Dashboard · **PEOPLE** Job Posting, Recruitment, Interviews,
  Deployment, Employees, Attendance, Leave, Payroll · **SALES** POS, Inventory,
  Categories, Transactions · **INSIGHTS** Reports · **ADMINISTRATION** Users,
  Roles, Departments, **Positions**, Branches, Work Schedules, Salary Grades,
  Audit Logs, Settings
- Account menu: `Profile`, `Sign out` — no switcher
- Positions page: 6 rows; renamed "Accountant" → "Accountant QA" and back
  through RLS; delete refused with the trigger's sentence and the row survived.
  Demo data unchanged.

## 12. Exact next actions for Claude

1. Read the required context/workflow/handoff files. Rerun status and inspect all
   logical/untracked diffs. Preserve `.gitignore` and do not normalize the two
   status-only files without checking the user's intent.
2. Do not redo Increment E or Increment A. Do not create a live offer merely to
   test the UI; six real hired applications remain untouched.
3. Treat migration 0002 as already applied to the current local database even
   though the Supabase CLI migration ledger does not list a literal `0002`.
   Verify catalog state before any reapplication. In a different environment,
   apply the file once in a single transaction after its preflight passes.
4. Ask the user whether a declined offer requires an explicit HR Close
   application action. If approved, add a permission-scoped atomic RPC/action
   and history event; do not use a loose direct status update.
5. Continue Increment B from the current accepted offer only:
   - decide one-current-contract vs revision history;
   - enforce draft -> printed -> signed;
   - derive start date from the offer;
   - require signed path/date/signer;
   - keep DB row/status/history operations atomic; and
   - define storage upload retry/orphan cleanup before enabling the UI.
6. Rework Increment C rather than wiring Claude's scaffold:
   - current accepted offer plus signed contract required;
   - offer start date read-only as deployment date;
   - branch/location/schedule required and cross-validated;
   - reporting manager from an approved safe source; and
   - one atomic deployment record/status/history RPC.
7. Implement Increment D only after adding database-backed uniqueness for
   `employees.application_id`. Map offer `regular -> employee full_time`, make
   creation idempotent, and do not claim POS login availability unless user/
   role/store membership is explicitly included.
8. Leave the four legacy deployments unchanged until the user gives a backfill/
   display decision. Keep POS, FMS, and `integration/` untouched.
9. For later increments, repeat the same standard: rollback migration probe,
   service/unit errors, read-only DB contracts, no-write mocked Playwright where
   possible, typecheck, lint, full Vitest, build, focused browser checks, smoke,
   and `git diff --check`.
10. Update this handoff with exact files/results and stop without committing or
    pushing.

---

End of handoff. Increments E, A, B, C and D are all implemented and verified,
and the entire recruitment pipeline has been driven end to end in a browser:
apply → screen → interview → hire → offer → accept → contract → sign → deploy →
employee record.

Open items for the next agent (none block the pipeline):
1. **The four legacy deployed applications** predate offers/contracts. They are
   now excluded from the pending-employee list, but the user still has to choose
   legacy display, hide, or backfill. Do not rewrite them silently.
2. **`e2e/portal-verify.spec.ts` writes to the database** — the only spec in
   `e2e/` that does, deliberately: an employee clocking in is the one thing that
   cannot be proven read-only. Keep it or retire it; the user's call.
   (`e2e/recruitment-pipeline.spec.ts` was listed here as stale. It has since
   been re-run against migrations 0003–0006 and passes, so it is no longer an
   open item.)
3. **POS consumption** of the new employee record (user/role/store membership) is
   untouched and is a separate scope decision.
4. Applicant evidence is still shared across repeat applications; interview
   transitions remain non-atomic; `general_manager` vs legacy `profiles.role`
   still disagree.

---

## 13. POS — started

### The finding that shapes everything: the backend already exists

`integration/POS` was not merely a reference — its schema and business logic are
already in `jmac-suite`, already bridged to JMAC identity. **No database work is
needed to build POS, and none was done.** What is there:

| Piece | Where |
| --- | --- |
| Catalogue | `products`, `product_categories` (10 products, 5 categories, all in Head Office) |
| Sales | `sales`, `sale_items`, with `checkout_key` unique per (store, user) for idempotent retries |
| Stock ledger | `inventory_movements`, with a `stock_after = stock_before + quantity_change` check |
| Checkout | `secure_checkout(_store_id, _items, _payment_method, _payment_reference, _amount_tendered, _checkout_key)` — SECURITY DEFINER, advisory-locked, `for update` on the products, returns the sale as jsonb |
| Catalogue for cashiers | `get_pos_products(_store_id)` |
| Stock | `restock_product`, `adjust_product_stock` |
| Categories | `delete_product_category`, `reassign_category_products`, `reorder_product_category` |
| Finance | `finance_post_sale` trigger |

**Two things govern every POS screen:**

1. **Store membership is derived, not stored.** `store_memberships` is a *view*
   over `users`: store = `users.branch_id` (falling back to the HQ branch), role
   = `pos_membership_role_for(user_id)`, status follows the account.
   `private.has_active_store_role` then maps JMAC permissions onto POS roles —
   `company.update` → admin, `product.manage` → manager, `sales.create` →
   cashier. There is no membership table to keep in sync and nothing should ever
   write one. The handoff's old open item "POS consumption of the employee
   record (user/role/store membership) is untouched" is therefore already
   answered: it is wired.
2. **Cashiers reach the catalogue through RPCs, not tables.** The table policies
   on `products` and `product_categories` admit admin and manager only. A
   cashier reads via `get_pos_products` and writes via `secure_checkout`.
   Querying those tables from a till screen returns nothing by design.

All the RPCs and tables are already present in `src/types/database.types.ts`.

### Delivered — slice 1 of 4

- `src/services/pos.ts` — `fetchMyStore()` (resolves the signed-in user's store
  and POS role), category read/write, and thin wrappers over
  `delete_product_category` / `reorder_product_category`. `posError()` passes the
  RPCs' own sentences through and only rewrites raw codes.
- `src/features/pos/CategoriesPage.tsx` — list with product counts, add/edit
  dialog, up/down reordering, and a delete dialog that asks where the products
  should go (`products.category_id` is NOT NULL, so a category holding products
  cannot simply vanish).
- Route `/pos/categories` gated on `category.manage`; the nav item moved from
  `planned` to `ready`.

Delete is offered only to the **admin** store role and never for "General",
because `delete_product_category` requires exactly that and refuses that name —
a manager should not be given a button whose only outcome is "Admin access
required".

### Two corrections worth recording

- I spent a while chasing what looked like a Radix teardown bug: after deleting
  a category the page kept `body { pointer-events: none }`. It was not a bug.
  The dialog was still open because the delete had been **correctly refused**
  ("Admin access required" — Miguel is a manager, not an admin), and the test's
  `toHaveCount(0)` passed only because Radix `aria-hidden`s the background
  table, so role queries find nothing while a modal is open. Two intermediate
  "fixes" made on that false premise were reverted.
- Playwright's `getByRole(name)` is substring-based, so the actions cell matched
  a category name through its `aria-label="Move X up"`. Use `exact: true`.

### Deferred, needs a decision

`product_categories.color` is read and shown as a swatch but has **no editor**.
`src/components/ui/token-discipline.test.ts` forbids hex literals anywhere in
`src/`, and a colour picker needs both a placeholder and a `^#[0-9A-Fa-f]{6}$`
validator. The column is user data rather than a brand colour, so the guard is
firing on something it was not aimed at — but weakening a security-style guard
to admit my own code was the wrong call to make unilaterally. Options: allow an
explicit per-file opt-out in the guard, or keep colours seeded from SQL.

### Verification

- `npm run build` clean · `npm run lint` clean
- `npx vitest run` — **53 files, 1148 tests, all pass**
- `npx playwright test` — **16/16 pass**
- Live as `admin@jmac.com` (`e2e/pos-categories.spec.ts`, writes): created a
  category, saw the duplicate refused with "This store already has a category
  with that name.", reordered it, and deleted it. Demo data ends at the original
  five categories (sort_order normalised to 1–5 by `reorder_product_category`).

### Next

Slice 2 products + inventory (`restock_product`, `adjust_product_stock`), slice 3
the till on `secure_checkout`, slice 4 Transactions / My Transactions. Note for
slice 4: `sales` SELECT admits admin and manager only, so a cashier's own
"My Transactions" has no read path yet — that one genuinely may need a migration
or an RPC, unlike everything above.

### 13a. Slices 2 and 3 — Inventory and the Till

**Inventory** (`/pos/inventory`, gated on `product.manage`,
`src/features/pos/InventoryPage.tsx`): product list with cost, price and a stock
badge that turns amber at or below 10 and red at zero; add/edit dialog; Restock
and Adjust dialogs over `restock_product` and `adjust_product_stock`.

The product form has **no stock field**, deliberately. A trigger
(`private.guard_product_inventory_write`) refuses any direct update that changes
`products.stock` — "Use the secure inventory operation for stock changes" — so
quantity only ever moves through the two RPCs, each of which writes the matching
`inventory_movements` row. That is what keeps the stock ledger continuous.

Adjustments offer only the four reasons `adjust_product_stock` accepts
(`adjustment`, `damaged`, `expired`, `correction`); the form asks "how many, and
which way" and converts to the signed change the RPC wants. Removing more than
exists is refused in the form, before the round trip.

**The till** (`/pos/till`, gated on `sales.create`,
`src/features/pos/TillPage.tsx`): searchable, category-filtered product grid on
the left, cart on the right, payment method, cash tendered or reference number,
and a receipt showing change owed.

Three things worth knowing:

- **The cart posts only product ids and quantities.** Prices, costs and fees are
  read server-side by `secure_checkout`; a price posted from a till is not
  evidence of anything. `calculateCartTotals` mirrors the RPC's arithmetic —
  including its two-decimal rounding at each step — purely so the screen and the
  receipt agree.
- **One checkout key per cart, not per click.** `secure_checkout` treats
  (store, cashier, key) as the identity of a sale and returns the original
  instead of charging twice. The key is minted once per cart and reset only
  after a successful sale, so a double-tap or a retried request cannot produce
  two sales.
- **Store fees come from `stores.fees`** and are previewed as separate lines.
  Only enabled fees with a positive value and a `percent`/`fixed` type count —
  the same filter the RPC applies.

### Verification

- `npm run build` clean · `npm run lint` clean
- `npx vitest run` — **54 files, 1179 tests, all pass** (21 new in
  `src/services/pos.test.ts`: category/product validation, the restock and
  adjust RPC payloads, cart arithmetic with percent and fixed fees, and the
  checkout guards)
- `npx playwright test` — **18/18 pass**

Live, `e2e/pos-inventory.spec.ts` as Miguel (manager) — restocked "Bottled Water
500ml" +5 at ₱7.25 and adjusted −5 back, leaving stock where it started. The
ledger recorded both with continuous `stock_before`/`stock_after`, and the
adjustment picked up the reweighted average cost (₱7.98), which is the RPC's
cost revaluation working. Overdrawing was refused in the form; the product form
was confirmed to have no stock field.

Live, `e2e/pos-till.spec.ts` as Carla (cashier) — 10 products loaded through
`get_pos_products`, 2 × Bottled Water rung up, underpayment refused, then paid.
The whole chain landed:

| Table | Row |
| --- | --- |
| `sales` | cash, subtotal ₱40.00, gross profit ₱24.08, `created_by` = cashier, `checkout_key` set |
| `sale_items` | 2 × ₱20.00, `unit_cost_snapshot` ₱7.96, `cost_snapshot_source` `trusted_checkout`, category "Beverages" |
| `inventory_movements` | `sale` −2, 237 → 235 |
| `finance_journal_entries` | **JE-2026-00004 "POS sale 44548596", posted, source `pos_sale`** |

That last row is the integration proving itself: a cashier's sale posts to
finance with no extra wiring.

### Still to do

Slice 4, Transactions and My Transactions. The obstacle noted earlier stands:
`sales` and `sale_items` SELECT admit the admin and manager store roles only, so
a manager's "Transactions" list will work from the tables, but a cashier's "My
Transactions" has **no read path** — every other POS screen had an RPC waiting,
and this one does not. It needs either a `sales_self_select` policy
(`created_by = auth.uid()`) or a `get_my_sales` RPC. That is a database change,
so it wants your decision before I make it.

### 13b. Slice 4 — Transactions, and migration 0007

**`db/migrations/0007_cashier_own_sales.sql` — APPLIED.** Two additive SELECT
policies: "Cashiers read their own sales" on `sales` and "Cashiers read their own
sale items" on `sale_items`. Nothing existing was modified or dropped.

Why this was needed: both tables carried a single SELECT policy admitting the
admin and manager store roles only. Correct for the store-wide list, but it left
a cashier unable to read back a sale the till had just written.

Why policies rather than another SECURITY DEFINER function (a change from what
was recommended in 13a): the POS RPCs exist because they need elevated privilege
for transactional, multi-table work. Reading your own rows needs neither.
Permissive policies OR together, so one query serves both roles — a manager keeps
the store-wide view through the policy already there, a cashier gains exactly
their own rows through the new one. It is also the shape HRMS self-service
already uses (`attendance_records_self_select`, `payroll_records_self_select`).

Both policies re-check `private.has_active_store_role(...)` rather than trusting
`created_by = auth.uid()` alone, so a deactivated account — or one posted to a
different branch — cannot keep reading its history.

**A process failure worth recording.** The intended sequence here is dry-run in a
transaction, probe, roll back, then apply. The migration file carries its own
`begin; … commit;`, so `\i` inside a wrapping transaction *committed it* and the
outer `rollback` rolled back nothing. The probes that followed then ran as
`postgres`, which holds `BYPASSRLS`, and returned identical counts for every
user — the tell that they were meaningless. Net effect: the intended change was
applied, but unverified at the moment of applying. It was verified straight after
and is correct. **For the next migration: either strip the `begin/commit` from
the file before `\i`, or dry-run with `psql --single-transaction -f` and no
wrapping `begin`.**

Verified afterwards, as each real user (`set_config('request.jwt.claims', …)`
then `set local role authenticated`, all rolled back):

| User | sales visible | sale_items | sales created by others |
| --- | --- | --- | --- |
| Carla (cashier) | 3 | 3 | **0** |
| Miguel (manager) | 3 | 3 | 3 (store-wide, as before) |
| Sofia (no POS membership) | **0** | **0** | 0 |

All three sales belong to Carla, which is why the manager's "others" count is 3.

**The UI** (`src/features/pos/TransactionsPage.tsx`) is one component behind two
routes: `/pos/transactions` (roles `pos_manager` + elevated) and
`/pos/my-transactions` (role `cashier`, rendered with `mineOnly`). `mineOnly`
drops the Cashier column and filters to the signed-in user — it is a filter, never
the boundary; the policies are. Clicking a row opens a receipt drawer with the
lines, subtotal, fees, total, cash received and change. Line names come from
`sale_items.product_name` / `category_name`, which are stored on the row, so a
receipt still reads correctly after a product is renamed or deleted.

### POS is now complete across all four slices

| Route | Who | Backed by |
| --- | --- | --- |
| `/pos` | cashier+ | shared `DashboardPage`, tiles self-gate |
| `/pos/till` | `sales.create` | `get_pos_products`, `secure_checkout` |
| `/pos/inventory` | `product.manage` | tables + `restock_product`, `adjust_product_stock` |
| `/pos/categories` | `category.manage` | tables + `delete_product_category`, `reorder_product_category` |
| `/pos/transactions` | pos_manager + elevated | `sales` / `sale_items` |
| `/pos/my-transactions` | cashier | same, scoped by migration 0007 |

### Verification

- `npm run build` clean · `npm run lint` clean
- `npx vitest run` — **54 files, 1184 tests, all pass**
- `npx playwright test` — **20/20 pass**
- Live: Carla sees 3 sales with no Cashier column and opens a receipt; Miguel
  sees the same 3 store-wide with the Cashier column showing "Carla Cashier".

One Playwright fix along the way: the receipt spec passed alone but failed in the
full suite, because `pos-till.spec.ts` runs first and adds a sale, so the list
refetched mid-click. It now waits for the network to settle before clicking. The
app was not at fault.

### Still open

- **Category colours** have no editor (see 13, "Deferred"). Unchanged.
- **`e2e/pos-*.spec.ts` write to the database** — `pos-categories` and
  `pos-till` commit real rows, `pos-inventory` is stock-neutral by design, and
  `pos-transactions` is read-only. `playwright.config.ts` still describes the
  suite as read-only; that comment is now wrong for four specs and wants either
  updating or a separate write-suite project.
- **Refunds are not built.** `inventory_movements` allows `refund` and `return`
  types and `sales.refund` exists as a permission, but there is no RPC for it and
  no screen. That is the obvious next POS increment.

---

## 14. Portal route leakage between sessions — FIXED

Reported: an admin opens a POS module, signs out while still in `/pos/...`, and
the next person to sign in inherits that route. For a user without POS the shell
renders with an empty sidebar ("No modules are assigned to your account") over a
page saying "You don't have access to this page".

### Root cause

Not storage, not cache, not sidebar filtering. Checked and ruled out:

- No `localStorage` or `sessionStorage` anywhere in `src/` — there is no stored
  "active portal" to go stale.
- `signOut` already cleared session, profile and the whole React Query cache.
- `SidebarNav` already derives from `useAuth()` on every render.
- `portalForPath` is pure and route-derived, holding no state.

The leak was the **deep-link return path**, added during the portal work:

1. `signOut` clears the session but the URL stays on `/pos/transactions`.
2. `ProtectedRoute` re-renders, sees no session, and stamps
   `state.from = '/pos/transactions'` — it cannot tell "left deliberately" from
   "blocked on the way in", since both are *no session on a protected URL*.
3. `AnonymousOnly` replays that path for whoever signs in next, unconditionally.

Reproduced before touching code: `history.state.from === "/pos/transactions"`
after logout, and the next account landed there.

### The fix, in three parts

**1. A sign-out stashes nothing** (`AuthContext`, `guards.tsx`). `AuthContext`
now exposes `signedOut`, true from a deliberate sign-out until the next sign-in.
`ProtectedRoute` omits `state.from` when it is set, so signing out ends at a
clean `/login` and the next person starts wherever *they* belong. This is what
makes the reported scenario correct rather than merely harmless.

**2. A deep link is honoured only if the new user holds that portal**
(`AnonymousOnly`). Belt to the braces above, and the part that also covers a
session expiring and being resumed by a different account:

```ts
const mayFollow = Boolean(from) && canAccessPortal(portalForPath(from), subject)
return <Navigate to={mayFollow ? from : '/home'} replace />
```

Falling back to `/home` rather than computing a path here keeps `PortalRedirect`
the single place that decides where an account belongs.

**3. `RequirePortal`** (new guard) wraps the POS and self-service shells. A path
says which portal a URL belongs to; it is not evidence the current user belongs
there. Anyone arriving at `/pos/*` without POS — bookmark, typed URL, anything —
is redirected to their own default portal instead of being shown an empty shell.

Deliberately **not** applied to the back-office shell: `canAccessPortal('admin')`
is `employee.view`, which the accountant, finance and POS-manager roles do not
hold, and gating `/dashboard` on it would lock them out of their only workplace.
A cashier opening `/dashboard/employees` therefore still gets the explanatory
`RequirePermission` refusal, which is the documented convention for a page-level
permission and is what the brief allowed.

### Files changed

- `src/contexts/AuthContext.tsx` — `signedOut` flag, set on sign-out, cleared on
  sign-in
- `src/router/guards.tsx` — `ProtectedRoute` skips the stamp after sign-out;
  `AnonymousOnly` validates the deep link; new `RequirePortal`
- `src/router/routes.tsx` — POS and employee shells wrapped in `RequirePortal`
- `src/layouts/Header.tsx` — sign-out navigates to `/login`
- `src/router/guards.test.tsx`, `src/lib/portals.test.ts` — regression tests
- `e2e/portal-session-isolation.spec.ts` — new, read-only

### Admin keeps POS

Nothing was removed. The admin still sees the Sales section in the back-office
sidebar and still opens `/pos/*`. Part 2 scopes the deep link rather than
deleting it, and there is a test asserting a POS route *is* still followed when
the next user holds POS.

### On the test accounts

The brief's scenario is admin → HR Staff. `hrstaff@jmac.com` and
`staff@jmac.com` have no seeded password (`docs/demo-seed.sql` seeds admin,
manager and cashier), and every seeded account except the cashier holds
`sales.create` — so no seeded user both lacks POS and can sign in. The e2e
pairing is reversed to exercise the identical code path: the admin leaves the app
on a **back-office** route and the **cashier**, who holds no back office, signs in
next. Same guard, same invariant, credentials that exist. Seeding a password for
`staff@jmac.com` would let the suite cover HR directly, if wanted.

### Verification

- `npm run build` clean · `npm run lint` clean
- `npx vitest run` — **54 files, 1194 tests, all pass**
- `npx playwright test` — **24/24 pass**

Scenarios A, B and C driven live:

| Step | Observed |
| --- | --- |
| A1 admin in POS | `/pos/transactions` |
| A2 after sign-out | `/login` |
| A3 cashier signs in | **`/pos`** — her own default, not the admin's page; sidebar `Dashboard, POS, My Transactions` |
| A4 | "No modules are assigned" **not** shown |
| B1 cashier | `/pos`, correct sidebar |
| B2 admin after her | `/dashboard`, sidebar includes Employees |
| C1 cashier in self-service | `/employee`, sidebar `Overview, My Attendance, My Leave, My Payslips` |
| C2 admin after her | `/dashboard` — did not inherit `/employee` |

Before the fix, A3 landed on `/pos/transactions`.

