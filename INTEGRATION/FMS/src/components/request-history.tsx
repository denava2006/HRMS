import {
  Check,
  CircleDollarSign,
  CornerUpLeft,
  FileEdit,
  Send,
  ShieldCheck,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { roleName } from "@/lib/rbac";
import type { ApprovalAction, RequestApproval, RequestStatus, UserRole } from "@/lib/types";

/** How each logged verb reads on the request timeline. */
const ENTRY: Record<ApprovalAction, { label: string; icon: LucideIcon; tone: string }> = {
  submitted: { label: "Submitted Request", icon: Send, tone: "text-blue-600 dark:text-blue-300" },
  edited: { label: "Edited Request", icon: FileEdit, tone: "text-slate-500 dark:text-slate-400" },
  resubmitted: { label: "Resubmitted Request", icon: Send, tone: "text-blue-600 dark:text-blue-300" },
  validated: { label: "Validated Request", icon: ShieldCheck, tone: "text-cyan-600 dark:text-cyan-300" },
  final_approved: { label: "Approved Request", icon: Check, tone: "text-emerald-600 dark:text-emerald-300" },
  completed: { label: "Payment Processed", icon: CircleDollarSign, tone: "text-teal-600 dark:text-teal-300" },
  returned: { label: "Returned Request", icon: CornerUpLeft, tone: "text-amber-600 dark:text-amber-300" },
  rejected: { label: "Rejected Request", icon: X, tone: "text-rose-600 dark:text-rose-300" },
  cancelled: { label: "Cancelled Request", icon: X, tone: "text-slate-500 dark:text-slate-400" },
};

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });

/**
 * Full audit trail of a request — who did what, when, and why. Reads from
 * `request_approvals`, which the requester can see for their own requests.
 */
export function RequestHistory({
  entries,
  status,
  completedAt,
}: {
  entries: (RequestApproval & { actor?: { full_name: string; role: UserRole } | null })[];
  status: RequestStatus;
  completedAt?: string | null;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-400">No activity recorded yet.</p>;
  }

  return (
    <ol className="relative space-y-0">
      {entries.map((e, i) => {
        const meta = ENTRY[e.action] ?? ENTRY.submitted;
        const Icon = meta.icon;
        const last = i === entries.length - 1 && status !== "completed";
        return (
          <li key={e.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 ${meta.tone}`}>
                <Icon className="h-4 w-4" />
              </span>
              {!last && <span className="w-px flex-1 bg-slate-200 dark:bg-slate-700" />}
            </div>
            <div className="min-w-0 flex-1 pb-5">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {meta.label}
                </span>
                <span className="text-xs text-slate-400">
                  {time(e.created_at)} · {formatDate(e.created_at)}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {e.actor?.full_name ?? "System"}
                {e.role_at_action && ` · ${roleName(e.role_at_action)}`}
              </p>
              {e.remarks && (
                <p className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
                  {(e.action === "returned" || e.action === "rejected") && (
                    <span className="font-medium">Reason: </span>
                  )}
                  {e.remarks}
                </p>
              )}
            </div>
          </li>
        );
      })}

      {/* The ledger entry the system writes once the Accountant is done. */}
      {status === "completed" && (
        <li className="flex gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Transaction Completed
              </span>
              {completedAt && (
                <span className="text-xs text-slate-400">
                  {time(completedAt)} · {formatDate(completedAt)}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              System · recorded to the ledger
            </p>
          </div>
        </li>
      )}
    </ol>
  );
}
