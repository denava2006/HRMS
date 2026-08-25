"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, LogIn, ShieldCheck } from "lucide-react";

const DEMO_ACCOUNTS = [
  { label: "Employee", email: "employee@fagle.ph" },
  { label: "Finance Staff", email: "finance.staff@fagle.ph" },
  { label: "Finance Manager", email: "finance.manager@fagle.ph" },
  { label: "Accountant", email: "accountant@fagle.ph" },
  { label: "Administrator", email: "admin@fagle.ph" },
];

const DEMO_PASSWORD = "Password123!";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn(withEmail?: string, withPassword?: string) {
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: withEmail ?? email,
      password: withPassword ?? password,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    const redirect = search.get("redirect") || "/dashboard";
    router.push(redirect);
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void signIn();
        }}
        className="space-y-4"
      >
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@fagle.ph"
            className="w-full rounded-xl border border-slate-200 bg-white/80 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-slate-200 bg-white/80 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:opacity-95 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogIn className="h-4 w-4" />
          )}
          Sign in
        </button>
      </form>

      <div className="mt-6">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          Demo accounts — one click to explore each role
        </div>
        <div className="grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              type="button"
              disabled={loading}
              onClick={() => void signIn(acc.email, DEMO_PASSWORD)}
              className="rounded-lg border border-slate-200 bg-white/60 px-3 py-2 text-left text-xs font-medium text-slate-600 transition hover:border-brand-400 hover:text-brand-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:text-brand-300"
            >
              {acc.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-center text-[11px] text-slate-400">
          All demo accounts use password{" "}
          <span className="font-mono text-slate-500 dark:text-slate-300">
            {DEMO_PASSWORD}
          </span>
        </p>
      </div>
    </div>
  );
}
