"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, CornerUpLeft, Loader2, X } from "lucide-react";
import { actOnRequest } from "@/lib/actions";
import { FormError } from "@/components/ui/form";
import { BudgetValidationModal } from "@/components/budget-validation-modal";
import type { ApprovalState } from "@/lib/types";

/**
 * Approving needs no explanation, but returning or rejecting must carry one —
 * those two buttons stay disabled until remarks are typed. The server enforces
 * the same rule.
 */
function Buttons({ approveLabel, hasRemarks }: { approveLabel: string; hasRemarks: boolean }) {
  const { pending } = useFormStatus();
  const needsRemarks = !hasRemarks;
  const reasonTitle = needsRemarks ? "Add remarks first — a reason is required" : undefined;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="submit"
        name="decision"
        value="approve"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {approveLabel}
      </button>
      <button
        type="submit"
        name="decision"
        value="return"
        disabled={pending || needsRemarks}
        title={reasonTitle}
        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
      >
        <CornerUpLeft className="h-4 w-4" /> Return
      </button>
      <button
        type="submit"
        name="decision"
        value="reject"
        disabled={pending || needsRemarks}
        title={reasonTitle}
        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
      >
        <X className="h-4 w-4" /> Reject
      </button>
    </div>
  );
}

export function ApprovalActions({
  requestId,
  approveLabel,
}: {
  requestId: string;
  approveLabel: string;
}) {
  const [state, formAction] = useActionState<ApprovalState, FormData>(actOnRequest, {});
  // Dismissing the modal must not re-open it on the next render, so track the
  // acknowledgement separately from the action result.
  const [dismissed, setDismissed] = useState(false);
  const [remarks, setRemarks] = useState("");
  const blocked = state.budgetBlock && !dismissed;

  return (
    <>
      <form
        action={(formData) => {
          setDismissed(false);
          formAction(formData);
        }}
        className="space-y-2.5"
      >
        <input type="hidden" name="request_id" value={requestId} />
        <textarea
          name="remarks"
          rows={2}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Add remarks — optional to approve, required to return or reject…"
          className="w-full rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200"
        />
        <Buttons approveLabel={approveLabel} hasRemarks={remarks.trim().length > 0} />
        <FormError message={state.error} />
      </form>

      {blocked && (
        <BudgetValidationModal
          result={state.budgetBlock!}
          onClose={() => setDismissed(true)}
        />
      )}
    </>
  );
}
