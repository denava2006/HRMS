"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Pencil, Send, XCircle } from "lucide-react";
import { cancelRequest, resubmitRequest } from "@/lib/actions";
import { FormError } from "@/components/ui/form";
import type { FormState } from "@/lib/types";

function Submitting({ label, icon: Icon, tone }: { label: string; icon: typeof Send; tone: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={tone}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </button>
  );
}

/** Edit + Resubmit, shown to the requester while a request sits in Returned. */
export function ReturnedActions({ requestId }: { requestId: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(resubmitRequest, {});

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/requests/${requestId}/edit`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/70 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Pencil className="h-4 w-4" /> Edit Request
        </Link>
        <form action={formAction}>
          <input type="hidden" name="request_id" value={requestId} />
          <Submitting
            label="Resubmit"
            icon={Send}
            tone="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-600 to-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:opacity-95 disabled:opacity-60"
          />
        </form>
      </div>
      <FormError message={state.error} />
    </div>
  );
}

/** Withdraw a request that Finance Staff has not picked up yet. */
export function CancelRequestButton({ requestId }: { requestId: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(cancelRequest, {});
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-rose-600 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <XCircle className="h-4 w-4" /> Cancel Request
        </button>
        <FormError message={state.error} />
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="request_id" value={requestId} />
      <span className="text-sm text-slate-500 dark:text-slate-400">Withdraw this request?</span>
      <Submitting
        label="Yes, cancel it"
        icon={XCircle}
        tone="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60"
      />
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-700 dark:hover:text-slate-300"
      >
        Keep it
      </button>
    </form>
  );
}
