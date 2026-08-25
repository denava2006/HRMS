"use client";

import { useFormStatus } from "react-dom";
import { Loader2, type LucideIcon } from "lucide-react";

/** Shared input and label styling so every form in the app looks identical. */
export const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white/70 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";

export const labelClass =
  "mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200";

/** Primary submit button that shows a spinner while the action is running. */
export function SubmitButton({ label, icon: Icon }: { label: string; icon?: LucideIcon }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:opacity-95 disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : Icon ? (
        <Icon className="h-4 w-4" />
      ) : null}
      {label}
    </button>
  );
}

/** Inline banner for a validation error returned by a Server Action. */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="rounded-xl bg-rose-500/10 px-3.5 py-2.5 text-sm font-medium text-rose-600 dark:text-rose-300">
      {message}
    </p>
  );
}
