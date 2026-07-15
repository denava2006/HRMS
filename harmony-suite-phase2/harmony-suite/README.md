# Harmony Suite HRMS

A modern Human Resource Management System — recruitment through payroll, built on
React, TypeScript, and Supabase.

## Status: Phase 1 of 8 — Auth & Access Control

- [x] **Phase 0** — Database schema (23 tables, RLS, audit/report infrastructure)
- [x] **Phase 1** — Auth & RBAC (this codebase: login, sessions, protected routes,
      role-based access)
- [ ] Phase 2 — Admin foundations (dashboard shell, HR accounts, departments,
      positions, salary grades, settings)
- [ ] Phase 3 — Recruitment (job postings, applicants, interviews, offers, contracts)
- [ ] Phase 4 — Employee Management
- [ ] Phase 5 — Attendance
- [ ] Phase 6 — Leave Management
- [ ] Phase 7 — Payroll
- [ ] Phase 8 — Reports, Audit Logs, Backup/Restore

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

## Getting started

```bash
npm install
cp .env.example .env
# then fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
npm run dev
```

Open http://localhost:5173. You'll land on `/login`; a valid Supabase Auth user
with a matching, active row in `public.profiles` is required to sign in.

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

See `hrms_schema.sql` (delivered alongside this project) for the full schema. It
covers all 8 modules, is fully normalized with FKs and indexes, and has Row Level
Security enabled on every table.
