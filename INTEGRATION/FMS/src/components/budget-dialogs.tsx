"use client";

import { useActionState, useEffect, useState } from "react";
import { PiggyBank, Plus } from "lucide-react";
import { allocateBudget, createBudget } from "@/lib/actions";
import { MONTH_NAMES, QUARTER_NAMES } from "@/lib/budget";
import { formatCurrency, sanitizeAmount } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { FormError, SubmitButton, fieldClass, labelClass } from "@/components/ui/form";
import type { BudgetPeriod, FormState } from "@/lib/types";

interface Option {
  id: string;
  name: string;
}

/** Money input that rejects letters, "e", "+" and "-" while typing or pasting. */
function AmountInput({ name, required }: { name: string; required?: boolean }) {
  const [value, setValue] = useState("");
  return (
    <input
      id={name}
      name={name}
      type="text"
      inputMode="decimal"
      required={required}
      value={value}
      onChange={(e) => setValue(sanitizeAmount(e.target.value))}
      onKeyDown={(e) => {
        if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
      }}
      placeholder="0.00"
      className={fieldClass}
    />
  );
}

// -----------------------------------------------------------------------------
// Finance Manager — set a budget ceiling
// -----------------------------------------------------------------------------

export function SetBudgetButton({ departments }: { departments: Option[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:opacity-95"
      >
        <Plus className="h-4 w-4" /> Set Budget
      </button>

      {open && (
        <Modal
          wide
          title="Set a Budget"
          description="Defines the ceiling that requests are charged against for one period."
          onClose={() => setOpen(false)}
        >
          <SetBudgetForm departments={departments} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

function SetBudgetForm({
  departments,
  onDone,
}: {
  departments: Option[];
  onDone: () => void;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(createBudget, {});
  const [period, setPeriod] = useState<BudgetPeriod>("monthly");
  const now = new Date();

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  const subPeriods = period === "monthly" ? MONTH_NAMES : period === "quarterly" ? QUARTER_NAMES : [];

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={state.error} />

      <div>
        <label className={labelClass} htmlFor="name">Budget Name *</label>
        <input id="name" name="name" required placeholder="e.g. Operations Monthly Budget" className={fieldClass} />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="department_id">Scope</label>
          <select id="department_id" name="department_id" defaultValue="" className={fieldClass}>
            <option value="">Company-wide</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="amount">Amount (₱) *</label>
          <AmountInput name="amount" required />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div>
          <label className={labelClass} htmlFor="period">Period *</label>
          <select
            id="period"
            name="period"
            value={period}
            onChange={(e) => setPeriod(e.target.value as BudgetPeriod)}
            className={fieldClass}
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="fiscal_year">Fiscal Year *</label>
          <input
            id="fiscal_year"
            name="fiscal_year"
            type="number"
            required
            min={2000}
            max={2100}
            defaultValue={now.getFullYear()}
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="period_index">
            {period === "monthly" ? "Month" : period === "quarterly" ? "Quarter" : "Covers"}
          </label>
          {subPeriods.length > 0 ? (
            <select
              id="period_index"
              name="period_index"
              defaultValue={period === "monthly"
                ? String(now.getMonth() + 1)
                : String(Math.floor(now.getMonth() / 3) + 1)}
              className={fieldClass}
            >
              {subPeriods.map((label, i) => (
                <option key={label} value={i + 1}>{label}</option>
              ))}
            </select>
          ) : (
            <input value="Jan 1 – Dec 31" readOnly className={`${fieldClass} text-slate-400`} />
          )}
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="alert_threshold">Alert Threshold (%)</label>
        <input
          id="alert_threshold"
          name="alert_threshold"
          type="number"
          min={1}
          max={100}
          defaultValue={80}
          className={`${fieldClass} sm:max-w-[10rem]`}
        />
        <p className="mt-1.5 text-xs text-slate-400">
          You are notified once spending against this budget passes this share of the amount.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-slate-200/70 pt-4 dark:border-slate-700/70">
        <p className="text-xs text-slate-400">
          Finance Staff are notified so they can start allocating against it.
        </p>
        <SubmitButton label="Save Budget" icon={Plus} />
      </div>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Finance Staff — draw an allocation from an existing ceiling
// -----------------------------------------------------------------------------

export function AllocateButton({
  budgetId,
  budgetName,
  remaining,
}: {
  budgetId: string;
  budgetName: string;
  remaining: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <PiggyBank className="h-3.5 w-3.5" /> Allocate
      </button>

      {open && (
        <Modal
          title="Allocate Budget"
          description={
            <>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {formatCurrency(remaining)}
              </span>{" "}
              still unallocated
              <span className="block text-xs text-slate-400">{budgetName}</span>
            </>
          }
          onClose={() => setOpen(false)}
        >
          <AllocateForm budgetId={budgetId} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

function AllocateForm({ budgetId, onDone }: { budgetId: string; onDone: () => void }) {
  const [state, formAction] = useActionState<FormState, FormData>(allocateBudget, {});

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={state.error} />
      <input type="hidden" name="budget_id" value={budgetId} />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="amount">Amount (₱) *</label>
          <AmountInput name="amount" required />
        </div>
        <div>
          <label className={labelClass} htmlFor="allocated_to">Allocated To *</label>
          <input
            id="allocated_to"
            name="allocated_to"
            required
            placeholder="e.g. Office Supplies"
            className={fieldClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="note">Note</label>
        <textarea id="note" name="note" rows={2} placeholder="What is this set aside for?" className={fieldClass} />
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-slate-200/70 pt-4 dark:border-slate-700/70">
        <p className="text-xs text-slate-400">The Finance Manager is notified of this allocation.</p>
        <SubmitButton label="Allocate" icon={PiggyBank} />
      </div>
    </form>
  );
}
