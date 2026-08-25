import { Suspense } from "react";
import { Wallet } from "lucide-react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="app-backdrop flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="glass-card w-full max-w-4xl overflow-hidden p-0 md:grid md:grid-cols-2">
        {/* Brand / marketing panel */}
        <div className="relative hidden flex-col justify-between bg-gradient-to-br from-brand-700 via-brand-600 to-emerald-600 p-8 text-white md:flex">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">Fagle</p>
              <p className="text-xs text-white/70">Financial Services Inc.</p>
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-2xl font-bold leading-tight">
              Finance Management System
            </h1>
            <p className="text-sm text-white/80">
              Digitized requests, automated approvals, real-time budgets and
              reports — one workflow from request to recorded transaction.
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-white/80">
              <li>• Multi-stage approval workflow</li>
              <li>• Budget tracking & alerts</li>
              <li>• Audit logs & accountability</li>
            </ul>
          </div>

          <p className="text-xs text-white/60">
            © {new Date().getFullYear()} Fagle Financial Services Inc.
          </p>
        </div>

        {/* Login form */}
        <div className="flex flex-col items-center justify-center p-8">
          <div className="mb-6 text-center md:hidden">
            <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-emerald-600 text-white">
              <Wallet className="h-5 w-5" />
            </div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Fagle FMS
            </h1>
          </div>
          <div className="mb-5 hidden w-full max-w-sm md:block">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              Welcome back
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Sign in to continue to the dashboard.
            </p>
          </div>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
