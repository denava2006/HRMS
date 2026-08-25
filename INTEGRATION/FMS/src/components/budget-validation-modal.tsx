"use client";

import { AlertTriangle, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { BudgetValidation } from "@/lib/types";

/**
 * Shown when a finance approver tries to advance a request the department
 * cannot afford. Purely informational — the request was never touched.
 */
export function BudgetValidationModal({
  result,
  onClose,
}: {
  result: BudgetValidation;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm sm:p-6"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Budget Validation Failed"
        onClick={(e) => e.stopPropagation()}
        className="glass-card flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col overflow-hidden bg-white/95 shadow-2xl dark:bg-slate-900/95 sm:max-h-[calc(100vh-3rem)]"
      >
        {/* Header stays put; only the figures below scroll. */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/70 px-6 pb-5 pt-6 dark:border-slate-700/70">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold leading-tight text-slate-800 dark:text-slate-100">
              Budget Validation Failed
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-5">
        <dl className="divide-y divide-slate-200/70 rounded-xl border border-slate-200/70 dark:divide-slate-700/70 dark:border-slate-700/70">
          <Row label="Department" value={result.departmentName} />
          <Row
            label="Remaining Budget"
            value={formatCurrency(result.remaining)}
            hint={`${formatCurrency(result.allocated)} allocated − ${formatCurrency(result.approvedExpenses)} approved expenses`}
          />
          <Row label="Requested Amount" value={formatCurrency(result.requested)} />
          <Row label="Budget Shortage" value={formatCurrency(result.shortage)} danger />
        </dl>

        <p className="mt-5 text-sm text-slate-600 dark:text-slate-300">
          This request exceeds the department&apos;s available budget.
        </p>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          Please reduce the requested amount or wait until additional budget becomes available.
        </p>

        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
          The request was not approved. It stays in{" "}
          <span className="font-medium text-slate-600 dark:text-slate-300">Finance Review</span> and
          no budget was deducted.
        </p>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  hint,
  danger,
}: {
  label: string;
  value: string;
  hint?: string;
  danger?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-3.5 py-2.5">
      <dt className="text-sm text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-right">
        <span
          className={`text-sm font-semibold ${danger ? "text-rose-600 dark:text-rose-300" : "text-slate-800 dark:text-slate-100"}`}
        >
          {value}
        </span>
        {hint && <span className="mt-0.5 block text-[11px] text-slate-400">{hint}</span>}
      </dd>
    </div>
  );
}
