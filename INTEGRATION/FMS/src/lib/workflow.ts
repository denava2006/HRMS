import type { RequestStatus, UserRole } from "./types";

export interface StatusMeta {
  key: RequestStatus;
  label: string;
  /** Which role is responsible for acting while a request sits in this status. */
  ownerRole: UserRole | null;
  /** Tailwind classes for a status badge (light + dark aware). */
  badge: string;
  description: string;
}

// The lifecycle metadata for every request status.
export const STATUS_META: Record<RequestStatus, StatusMeta> = {
  draft: {
    key: "draft",
    label: "Draft",
    ownerRole: "employee",
    badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    description: "Being prepared by the requester.",
  },
  pending_finance_staff: {
    key: "pending_finance_staff",
    label: "Finance Review",
    ownerRole: "finance_staff",
    badge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
    description: "Awaiting Finance Staff review, validation and budget check.",
  },
  pending_finance_manager: {
    key: "pending_finance_manager",
    label: "Finance Approval",
    ownerRole: "finance_manager",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    description: "Awaiting Finance Manager final approval.",
  },
  pending_accountant: {
    key: "pending_accountant",
    label: "Payment Processing",
    ownerRole: "accountant",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    description: "Approved and budget reserved — awaiting the Accountant to pay and record it.",
  },
  completed: {
    key: "completed",
    label: "Completed",
    ownerRole: null,
    badge: "bg-emerald-600/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    description: "Paid and recorded to the ledger — workflow complete.",
  },
  returned: {
    key: "returned",
    label: "Returned",
    ownerRole: "employee",
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
    description: "Sent back for revision — edit it and resubmit.",
  },
  rejected: {
    key: "rejected",
    label: "Rejected",
    ownerRole: null,
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    description: "Rejected and closed — this request cannot be revised or resubmitted.",
  },
  cancelled: {
    key: "cancelled",
    label: "Cancelled",
    ownerRole: null,
    badge: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
    description: "Withdrawn by the requester.",
  },
};

/**
 * The happy-path approval chain, in order. Each step names the role that acts
 * and the status the request moves INTO when that role approves. This is the
 * "every user depends on the previous user" backbone of the system.
 */
export interface WorkflowStep {
  status: RequestStatus; // status while waiting for this step
  role: UserRole; // role that must act
  actionLabel: string; // what the action button says
  resultLabel: string; // what happens on success
}

export const WORKFLOW: WorkflowStep[] = [
  {
    status: "pending_finance_staff",
    role: "finance_staff",
    actionLabel: "Validate & Approve",
    resultLabel: "Sent to Finance Manager",
  },
  {
    status: "pending_finance_manager",
    role: "finance_manager",
    actionLabel: "Final Approve",
    resultLabel: "Sent to Accountant",
  },
  {
    status: "pending_accountant",
    role: "accountant",
    actionLabel: "Pay & Record",
    resultLabel: "Completed — payment released and recorded",
  },
];

/**
 * The five milestones shown on the request progress bar:
 *   Submitted → Finance Review → Finance Approved → Payment Processing → Completed
 * "Submitted" is reached by every request that has left draft, so it has no
 * status of its own.
 */
export const WORKFLOW_TIMELINE: { status: RequestStatus | null; label: string }[] = [
  { status: null, label: "Submitted" },
  { status: "pending_finance_staff", label: "Finance Review" },
  { status: "pending_finance_manager", label: "Finance Approved" },
  { status: "pending_accountant", label: "Payment Processing" },
  { status: "completed", label: "Completed" },
];

/** The next status a request moves to when its current owner approves. */
export function nextStatus(current: RequestStatus): RequestStatus | null {
  const idx = WORKFLOW.findIndex((s) => s.status === current);
  if (idx === -1) return null;
  const next = WORKFLOW[idx + 1];
  return next ? next.status : "completed";
}

/** The stages where somebody still has to act for the request to move. */
export const ACTIONABLE_STATUSES: RequestStatus[] = [
  "pending_finance_staff",
  "pending_finance_manager",
  "pending_accountant",
];

/**
 * True when the given role may act on a request at this status.
 *
 * The Administrator oversees the whole process and can step into any stage that
 * is still open — but not into one that is already closed. Without that second
 * half an admin's queue would list completed and rejected requests with live
 * approve buttons on them.
 */
export function canActOn(status: RequestStatus, role: UserRole | null | undefined): boolean {
  if (!role) return false;
  if (role === "administrator") return ACTIONABLE_STATUSES.includes(status);
  return STATUS_META[status]?.ownerRole === role;
}

/** True when the Administrator is standing in for the stage's normal owner. */
export function isActingForOthers(
  status: RequestStatus,
  role: UserRole | null | undefined,
): boolean {
  return role === "administrator" && STATUS_META[status]?.ownerRole !== "administrator";
}

/** How far along the timeline a status is (0-based index), for progress bars. */
export function timelineIndex(status: RequestStatus): number {
  if (status === "draft") return -1;
  if (status === "completed") return WORKFLOW_TIMELINE.length - 1;
  const idx = WORKFLOW_TIMELINE.findIndex((s) => s.status === status);
  // returned / rejected / cancelled have no milestone — they sit at "Submitted".
  return idx === -1 ? 0 : idx;
}

/** Requests an employee may still revise. A rejection is final. */
export function isEditable(status: RequestStatus): boolean {
  return status === "returned" || status === "draft";
}

/** Terminal states — nothing further happens to the request. */
export function isClosed(status: RequestStatus): boolean {
  return status === "rejected" || status === "cancelled" || status === "completed";
}

/** Remarks are mandatory when sending a request back or killing it. */
export function remarksRequired(decision: string): boolean {
  return decision === "return" || decision === "reject";
}
