"use client";

import { useActionState, useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { createIncome } from "@/lib/actions";
import { sanitizeAmount } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { FormError, SubmitButton, fieldClass, labelClass } from "@/components/ui/form";
import type { FormState } from "@/lib/types";

interface Option {
  id: string;
  name: string;
}

export function RecordIncomeButton({
  categories,
  accounts,
  departments,
}: {
  categories: Option[];
  accounts: Option[];
  departments: Option[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:opacity-95"
      >
        <TrendingUp className="h-4 w-4" /> Record Income
      </button>

      {open && (
        <Modal
          wide
          title="Record Income"
          description="Money received by the company — client payments, retainers, interest."
          onClose={() => setOpen(false)}
        >
          <RecordIncomeForm
            categories={categories}
            accounts={accounts}
            departments={departments}
            onDone={() => setOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}

function RecordIncomeForm({
  categories,
  accounts,
  departments,
  onDone,
}: {
  categories: Option[];
  accounts: Option[];
  departments: Option[];
  onDone: () => void;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(createIncome, {});
  const [amount, setAmount] = useState("");
  const [today, setToday] = useState("");

  // Computed after mount so the server and client markup agree.
  useEffect(() => {
    const d = new Date();
    setToday(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
  }, []);

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={state.error} />

      <div>
        <label className={labelClass} htmlFor="source">Source *</label>
        <input
          id="source"
          name="source"
          required
          placeholder="e.g. Consulting revenue — Acme Corp."
          className={fieldClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="amount">Amount (₱) *</label>
          <input
            id="amount"
            name="amount"
            type="text"
            inputMode="decimal"
            required
            value={amount}
            onChange={(e) => setAmount(sanitizeAmount(e.target.value))}
            onKeyDown={(e) => {
              if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
            }}
            placeholder="0.00"
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="received_date">Date Received *</label>
          <input
            id="received_date"
            name="received_date"
            type="date"
            required
            max={today}
            defaultValue={today}
            key={today}
            className={fieldClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="category_id">Category</label>
          <select id="category_id" name="category_id" defaultValue="" className={fieldClass}>
            <option value="">— Select —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="account_id">Deposited To</label>
          <select id="account_id" name="account_id" defaultValue="" className={fieldClass}>
            <option value="">— Select —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="department_id">Department</label>
        <select id="department_id" name="department_id" defaultValue="" className={fieldClass}>
          <option value="">Company-wide</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass} htmlFor="description">Description</label>
        <textarea id="description" name="description" rows={2} placeholder="Reference or notes" className={fieldClass} />
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-slate-200/70 pt-4 dark:border-slate-700/70">
        <p className="text-xs text-slate-400">A reference number is generated automatically.</p>
        <SubmitButton label="Record Income" icon={TrendingUp} />
      </div>
    </form>
  );
}
