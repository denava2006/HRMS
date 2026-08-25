"use client";

import { useActionState, useEffect, useState } from "react";
import { Send } from "lucide-react";
import { createRequest } from "@/lib/actions";
import { sanitizeAmount } from "@/lib/utils";
import { FormError, SubmitButton, fieldClass, labelClass } from "@/components/ui/form";
import { useCategoryVendor, type VendorOption } from "@/components/use-category-vendor";
import type { FormState, RequestType } from "@/lib/types";

interface Option {
  id: string;
  name: string;
}

export function RequestForm({
  type,
  departments,
  categories,
  vendors,
  defaultDepartmentId,
}: {
  type: RequestType;
  departments: Option[];
  categories: Option[];
  vendors: VendorOption[];
  defaultDepartmentId?: string | null;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(createRequest, {});
  const [amount, setAmount] = useState("");
  // Category and Vendor narrow each other, so a hardware supplier can never be
  // paired with "Meals & Representation" in either direction.
  const cv = useCategoryVendor(categories, vendors);
  // Requests may only target today or a future date — no past dates.
  const [minDate, setMinDate] = useState("");
  useEffect(() => {
    const d = new Date();
    setMinDate(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
  }, []);

  return (
    <form action={formAction} className="glass-card max-w-2xl space-y-5 p-6">
      <input type="hidden" name="type" value={type} />
      <FormError message={state.error} />

      <div>
        <label className={labelClass}>Title *</label>
        <input
          name="title"
          required
          placeholder={type === "purchase" ? "e.g. New Laptop for Operations" : "e.g. Client Meeting Transportation"}
          className={fieldClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Amount (₱) *</label>
          <input
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
          <label className={labelClass}>Priority *</label>
          <select name="priority" defaultValue="medium" required className={fieldClass}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Department *</label>
          <select
            name="department_id"
            defaultValue={defaultDepartmentId ?? ""}
            required
            className={fieldClass}
          >
            <option value="">— Select —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Category *</label>
          <select
            name="category_id"
            value={cv.categoryId}
            onChange={(e) => cv.chooseCategory(e.target.value)}
            required
            className={fieldClass}
          >
            <option value="">— Select —</option>
            {cv.visibleCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {type === "purchase" ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Vendor *</label>
            <select
              name="vendor_id"
              value={cv.vendorId}
              onChange={(e) => cv.chooseVendor(e.target.value)}
              required
              className={fieldClass}
            >
              <option value="">— Select —</option>
              {cv.visibleVendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Needed By *</label>
            <input name="needed_by" type="date" min={minDate} required className={fieldClass} />
          </div>
        </div>
      ) : (
        <div>
          <label className={labelClass}>Expense Date *</label>
          <input name="expense_date" type="date" min={minDate} required className={fieldClass} />
        </div>
      )}

      <div>
        <label className={labelClass}>Description *</label>
        <textarea
          name="description"
          rows={2}
          required
          placeholder="What is this for?"
          className={fieldClass}
        />
      </div>

      <div>
        <label className={labelClass}>Justification *</label>
        <textarea
          name="justification"
          rows={2}
          required
          placeholder="Why is it needed?"
          className={fieldClass}
        />
      </div>

      <div>
        <label className={labelClass}>Attachments *</label>
        <input
          name="attachments"
          type="file"
          multiple
          required
          accept="image/png,image/jpeg,image/webp,application/pdf"
          className={`${fieldClass} file:mr-3 file:rounded-lg file:border-0 file:bg-brand-500/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 dark:file:text-brand-300`}
        />
        <p className="mt-1.5 text-xs text-slate-400">
          Quotations or receipts — PNG, JPG, WEBP or PDF, up to 10 MB each.
        </p>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200/70 pt-4 dark:border-slate-700/70">
        <p className="text-xs text-slate-400">
          Submitting sends this to Finance Staff for review.
        </p>
        <SubmitButton label="Submit Request" icon={Send} />
      </div>
    </form>
  );
}
