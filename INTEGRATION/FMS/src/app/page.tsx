import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Wallet,
  ArrowRight,
  ShieldCheck,
  Workflow,
  Bell,
  BarChart3,
  ScrollText,
  Gauge,
  FileText,
  CheckCircle2,
  Users,
  Building2,
  Calculator,
  UserCog,
} from "lucide-react";
import { getProfile } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";

const FEATURES = [
  { icon: Workflow, title: "Automated Approval Workflow", desc: "Every request routes itself from one reviewer to the next until it is paid and recorded — no chasing signatures." },
  { icon: Gauge, title: "Real-Time Budgets", desc: "Track allocation and spending per department as it happens, with alerts before a budget runs over." },
  { icon: BarChart3, title: "Live Financial Reports", desc: "Income, expenses, and net profit visualized instantly, with income-vs-expense trends at a glance." },
  { icon: Bell, title: "Smart Notifications", desc: "Each hand-off notifies exactly the role that must act next, so work never stalls in an inbox." },
  { icon: ScrollText, title: "Full Audit Trail", desc: "Every submission, approval, payment, and edit is logged with who did what and when." },
  { icon: ShieldCheck, title: "Role-Based Security", desc: "Row-level database permissions keep financial data visible only to the people who should see it." },
];

const STEPS = [
  { n: 1, role: "Employee", action: "Submits a request", icon: FileText },
  { n: 2, role: "Finance Staff", action: "Reviews & validates", icon: CheckCircle2 },
  { n: 3, role: "Finance Manager", action: "Final approval", icon: ShieldCheck },
  { n: 4, role: "Accountant", action: "Pays & records", icon: Calculator },
];

const ROLES = [
  { icon: FileText, name: "Employee", desc: "Creates and tracks purchase & reimbursement requests." },
  { icon: CheckCircle2, name: "Finance Staff", desc: "First reviewer — validates documents and checks budgets." },
  { icon: ShieldCheck, name: "Finance Manager", desc: "Grants final approval and monitors company budgets." },
  { icon: Calculator, name: "Accountant", desc: "Processes payment and records the transaction to the ledger." },
  { icon: UserCog, name: "Administrator", desc: "Manages users, departments, categories and audit logs." },
];

export default async function LandingPage() {
  const profile = await getProfile();
  if (profile) redirect("/dashboard");

  return (
    <div className="app-backdrop min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-white/40 bg-white/70 backdrop-blur-md dark:border-white/10 dark:bg-slate-900/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-emerald-600 text-white shadow-lg shadow-brand-600/25">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Fagle FMS</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Financial Services Inc.</p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex dark:text-slate-300">
            <a href="#features" className="transition hover:text-brand-600 dark:hover:text-brand-300">Features</a>
            <a href="#workflow" className="transition hover:text-brand-600 dark:hover:text-brand-300">Workflow</a>
            <a href="#roles" className="transition hover:text-brand-600 dark:hover:text-brand-300">Roles</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:opacity-95">
              Sign in <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
            <Workflow className="h-3.5 w-3.5" /> Dynamic approval workflow, not just data entry
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
            Finance operations, from request to{" "}
            <span className="bg-gradient-to-r from-brand-600 to-emerald-600 bg-clip-text text-transparent">
              recorded transaction
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-slate-600 sm:text-lg dark:text-slate-300">
            Fagle FMS digitizes purchase requests, reimbursements, budgets, and
            payments into one automated workflow — where every user&apos;s action
            creates the next user&apos;s task, with real-time reports and a full
            audit trail.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:opacity-95">
              Get Started <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#workflow" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-6 py-3 text-sm font-semibold text-slate-700 backdrop-blur transition hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
              See how it works
            </a>
          </div>

          {/* Trust stats */}
          <div className="mx-auto mt-14 grid max-w-2xl grid-cols-3 gap-4">
            {[
              { k: "5", v: "User roles" },
              { k: "4", v: "Approval stages" },
              { k: "100%", v: "Audited actions" },
            ].map((s) => (
              <div key={s.v} className="glass-card p-4">
                <p className="bg-gradient-to-r from-brand-600 to-emerald-600 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">{s.k}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{s.v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">Everything finance needs, in one place</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-400">Built to replace spreadsheets, paper forms, and email approvals.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="glass-card p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/15 to-emerald-500/15 text-brand-600 dark:text-brand-300">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">{f.title}</h3>
                <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Workflow */}
      <section id="workflow" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="glass-card p-8 sm:p-10">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">One request, four hand-offs</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">Each approval automatically becomes the next person&apos;s task.</p>
          </div>
          <div className="flex flex-col items-stretch gap-4 md:flex-row md:items-center">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.n} className="flex flex-1 items-center gap-4 md:flex-col md:text-center">
                  <div className="flex flex-col items-center gap-3 md:w-full">
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-emerald-600 text-white shadow-lg shadow-brand-600/25">
                      <Icon className="h-6 w-6" />
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-brand-700 shadow dark:bg-slate-900 dark:text-brand-300">{s.n}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{s.role}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{s.action}</p>
                    </div>
                  </div>
                  {i < STEPS.length - 1 && (
                    <ArrowRight className="hidden h-5 w-5 shrink-0 text-slate-300 md:block dark:text-slate-600" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-8 flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" /> Dashboard, reports, budgets and audit log update automatically.
          </div>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">A role for every responsibility</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-400">Access and screens adapt to who is signed in.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {ROLES.map((r) => {
            const Icon = r.icon;
            return (
              <div key={r.name} className="glass-card p-5 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/15 to-emerald-500/15 text-brand-600 dark:text-brand-300">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{r.name}</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{r.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-emerald-600 p-10 text-center text-white shadow-glass sm:p-14">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-emerald-300/20 blur-2xl" />
          <h2 className="relative text-2xl font-bold sm:text-3xl">Ready to modernize your finance operations?</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-white/80">
            Sign in with a demo account and follow a request all the way from
            submission to a recorded transaction.
          </p>
          <Link href="/login" className="relative mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-brand-700 shadow-lg transition hover:bg-white/90">
            Sign in to the dashboard <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/40 bg-white/50 py-8 backdrop-blur dark:border-white/10 dark:bg-slate-900/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-slate-500 sm:flex-row sm:px-6 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-brand-600 dark:text-brand-300" />
            <span>Fagle Financial Services Inc.</span>
          </div>
          <p>© {new Date().getFullYear()} Finance Management System. For academic demonstration.</p>
        </div>
      </footer>
    </div>
  );
}
