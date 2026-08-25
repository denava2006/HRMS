"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Lock, Save, Trash2 } from "lucide-react";
import { deleteAttachment, updateRequest } from "@/lib/actions";
import { sanitizeAmount } from "@/lib/utils";
import { FormError, SubmitButton, fieldClass, labelClass } from "@/components/ui/form";
import { useCategoryVendor, type VendorOption } from "@/components/use-category-vendor";
import type { FormState, RequestType } from "@/lib/types";

interface Option {
  id: string;
  name: string;
}

interface Attachment {
  id: string;
  file_name: string;
}

/**
 * Revision form for a returned request. Title, description, vendor, amount,
 * needed date, category and attachments are editable; the request number,
 * department and requester are fixed and shown read-only.
 */
export function EditRequestForm({
  requestId,
  type,
  requestNo,
  departmentName,
  requesterName,
  defaults,
  categories,
  vendors,
  attachments,
}: {
  requestId: string;
  type: RequestType;
  requestNo: string;
  departmentName: string;
  requesterName: string;
  defaults: {
    title: string;
    description: string;
    justification: string;
    amount: string;
    category_id: string;
    vendor_id: string;
    needed_by: string;
    expense_date: string;
  };
  categories: Option[];
  vendors: VendorOption[];
  attachments: Attachment[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(updateRequest, {});
  const [amount, setAmount] = useState(defaults.amount);
  // Same two-way narrowing as the new-request form, seeded from the saved values.
  const cv = useCategoryVendor(categories, vendors, {
    categoryId: defaults.category_id,
    vendorId: defaults.vendor_id,
  });

  return (
    <form action={formAction} className="glass-card max-w-3xl space-y-5 p-6">
      <input type="hidden" name="request_id" value={requestId} />
      <FormError message={state.error} />

      {/* Fixed for the life of the request. */}
      <div className="grid grid-cols-1 gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-3 dark:bg-slate-800/40">
        <Locked label="Request No." value={requestNo} />
        <Locked label="Department" value={departmentName} />
        <Locked label="Requester" value={requesterName} />
      </div>

      <div>
        <label className={labelClass} htmlFor="title">Title *</label>
        <input id="title" name="title" required defaultValue={defaults.title} className={fieldClass} />
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
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="category_id">Category *</label>
          <select
            id="category_id"
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

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {type === "purchase" && (
          <div>
            <label className={labelClass} htmlFor="vendor_id">Vendor *</label>
            <select
              id="vendor_id"
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
        )}
        {type === "purchase" ? (
          <div>
            <label className={labelClass} htmlFor="needed_by">Needed By *</label>
            <input
              id="needed_by"
              name="needed_by"
              type="date"
              required
              defaultValue={defaults.needed_by}
              className={fieldClass}
            />
          </div>
        ) : (
          <div>
            <label className={labelClass} htmlFor="expense_date">Expense Date *</label>
            <input
              id="expense_date"
              name="expense_date"
              type="date"
              required
              defaultValue={defaults.expense_date}
              className={fieldClass}
            />
          </div>
        )}
      </div>

      <div>
        <label className={labelClass} htmlFor="description">Description *</label>
        <textarea
          id="description"
          name="description"
          rows={2}
          required
          defaultValue={defaults.description}
          className={fieldClass}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="justification">Justification *</label>
        <textarea
          id="justification"
          name="justification"
          rows={2}
          required
          defaultValue={defaults.justification}
          className={fieldClass}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="attachments">
          Attachments {attachments.length === 0 && "*"}
        </label>
        {attachments.length > 0 && (
          <ul className="mb-2 space-y-1.5">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/40">
                <span className="truncate text-slate-600 dark:text-slate-300">{a.file_name}</span>
                <RemoveAttachment attachmentId={a.id} />
              </li>
            ))}
          </ul>
        )}
        {/* Only mandatory when nothing is attached — a revision keeps the files
            already on the request. */}
        <input
          id="attachments"
          name="attachments"
          type="file"
          multiple
          required={attachments.length === 0}
          accept="image/png,image/jpeg,image/webp,application/pdf"
          className={`${fieldClass} file:mr-3 file:rounded-lg file:border-0 file:bg-brand-500/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 dark:file:text-brand-300`}
        />
        <p className="mt-1.5 text-xs text-slate-400">
          PNG, JPG, WEBP or PDF — up to 10 MB each. Existing files are kept unless removed.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-slate-200/70 pt-4 dark:border-slate-700/70">
        <Link
          href={`/requests/${requestId}`}
          className="text-sm font-medium text-slate-500 transition hover:text-slate-700 dark:hover:text-slate-300"
        >
          Cancel
        </Link>
        <SubmitButton label="Save Changes" icon={Save} />
      </div>
    </form>
  );
}

/** Nested form would be invalid HTML, so removal posts through a formAction. */
function RemoveAttachment({ attachmentId }: { attachmentId: string }) {
  const [, formAction] = useActionState<FormState, FormData>(deleteAttachment, {});
  return (
    <button
      type="submit"
      formAction={formAction}
      name="attachment_id"
      value={attachmentId}
      aria-label="Remove attachment"
      className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-600"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

function Locked({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-slate-400">
        <Lock className="h-3 w-3" /> {label}
      </p>
      <p className="mt-0.5 text-sm font-medium text-slate-600 dark:text-slate-300">{value}</p>
    </div>
  );
}
