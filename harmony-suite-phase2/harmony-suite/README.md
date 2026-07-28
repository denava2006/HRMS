# Harmony Suite HRMS

A modern Human Resource Management System — recruitment through payroll, built on
React, TypeScript, and Supabase.

## Status

All core modules are built: Auth & RBAC, Admin foundations (HR accounts,
departments, positions, salary grades, settings), Recruitment, Interview
Management, Deployment, Employee Management, Attendance, Leave, Payroll,
Reports & Export, a live HR/Admin Dashboard, and a self-service Employee
Portal (Dashboard, Attendance, Leave, Payroll).

## Tech stack

- **Frontend:** React 19 + TypeScript, Vite, Tailwind CSS v4, shadcn/ui (hand-authored
  components — see note below), Framer Motion, React Router, React Hook Form + Zod
- **Backend:** Supabase (Postgres, Auth, Storage, RLS)
- **Deploy:** Vercel + GitHub

> **Note on shadcn/ui:** the `shadcn` CLI fetches component source from
> `ui.shadcn.com`, which wasn't reachable from the build sandbox this project was
> assembled in. The components in `src/components/ui/` are hand-written to the same
> conventions (Radix primitives, CVA variants, `cn()` merging) so the *code* is
> equivalent — but if you have CLI access, `npx shadcn@latest add <component>` will
> work normally for anything new you need.

## Getting started (local Supabase — recommended)

The whole backend (Postgres, Auth, Storage, Realtime, Edge Functions) runs
locally in Docker via the Supabase CLI. No cloud project, API keys, or network
access needed — this is also what makes the app easy to hand to someone else
or run live during a demo.

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/)
running, and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
(`npm i -g supabase`, or see the link for other install methods).

```bash
npm install
cp .env.example .env          # already points at the local stack's fixed dev URL/anon key

supabase start                # first run pulls Docker images — a few minutes
                               # applies every migration in supabase/migrations/
                               # and seeds supabase/seed.sql (admin login + sample
                               # departments/positions/salary grades)
npm run dev
```

Open http://localhost:5173 and sign in with **admin@suite.com / Admin123**.

### HR Staff and Employee logins

Because this runs on a local, per-person Supabase stack rather than one shared
mailbox-reachable project, account creation doesn't send a real invite email —
there's no inbox for it to reach for anyone other than whoever is running it
locally. Instead, HR Staff and Employee accounts created from the UI (*HR
Accounts → New account*, or *Employees → Create Employee* / *Generate Employee
Account*) are active immediately with a fixed default password:

- **HR Staff:** the email you enter, password `HrStaff123`
- **Employee:** the applicant's own email (carried through from their job
  application — not re-entered), password `Employee123`

Useful commands:

| Command | Purpose |
|---|---|
| `supabase start` | Start the local stack (idempotent — safe to re-run) |
| `supabase stop` | Stop it (add `--no-backup` to also discard local data) |
| `supabase db reset` | Wipe local data and replay all migrations + the seed — the fastest way back to a clean demo state |
| `supabase status` | Print the local API URL, Studio URL, and keys again |

Supabase Studio (a local admin UI for the database, auth users, storage, and
logs) is at http://127.0.0.1:55323. Inbucket, the local email inbox that
catches invite/reset emails instead of sending them, is at
http://127.0.0.1:55324.

This project's local ports are shifted to the `5532x` range (instead of the
CLI's `5432x` defaults) in `supabase/config.toml`, so it can run alongside
other local Supabase projects on the same machine without a port clash.

### Using a hosted (cloud) project instead

Uncomment the `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` pair under
"Remote (cloud) Supabase project" in `.env.example` and fill in your own
project's values from *Project Settings → API*. Everything in
`supabase/migrations/` applies there too via `supabase link` + `supabase db push`
if you're setting up a fresh cloud project from this codebase.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Local dev server with hot reload |
| `npm run build` | Type-check (`tsc -b`) then production build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Lint with oxlint |

## Project structure

```
src/
  components/
    ui/            # shadcn-style primitives (Button, Input, Label, Card)
    ProtectedRoute.tsx
  contexts/
    AuthContext.tsx  # session + profile (role/status), signIn/signOut
  lib/
    supabase.ts      # Supabase client singleton
    database.types.ts # hand-written for Phase 1; regenerate once schema is live
    utils.ts          # cn() class-merging helper
  pages/
    LoginPage.tsx
    DashboardStub.tsx  # placeholder landing; full dashboard is Phase 2
```

## Design tokens

Brand palette (`src/index.css`) — Deep Navy `#0f2a43`, Ocean Blue `#1d6fa5`, Teal
`#12a594`, Mist `#f3f6f9`. Display type is Manrope, body/UI is IBM Plex Sans, and
numeric fields (employee IDs, payroll figures) use IBM Plex Mono. All three are
self-hosted via `@fontsource` — no external font CDN at runtime.

## Deployment

This is a standard Vite app — Vercel auto-detects the build. Set
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Environment Variables in the
Vercel project settings (not committed to the repo).

## Database

The full schema — every table, enum, function, trigger, and RLS policy — lives
as an ordered set of SQL migrations in `supabase/migrations/`, applied in
order by `supabase start` / `supabase db reset`. There is no separate schema
dump to keep in sync; the migrations directory *is* the schema. RLS is enabled
on every table, and `supabase/seed.sql` seeds a starter admin login plus
reference data (departments, positions, salary grades) for local/demo use.
