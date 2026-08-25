"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth";
import {
  canActOn,
  isClosed,
  isEditable,
  nextStatus,
  remarksRequired,
  STATUS_META,
} from "@/lib/workflow";
import {
  ALL_ROLES,
  canAllocateBudget,
  canManageBudgets,
  canManageVendors,
  canRecordIncome,
  isAdmin,
  roleName,
} from "@/lib/rbac";
import { periodRange } from "@/lib/budget";
import {
  formatCurrency,
  hasLetter,
  normalizeContactNumber,
  normalizeTin,
  sanitizeCompanyName,
  sanitizePersonName,
} from "@/lib/utils";
import type {
  ApprovalAction,
  ApprovalState,
  BudgetPeriod,
  BudgetValidation,
  FormState,
  RequestStatus,
  RequestType,
  UserRole,
} from "@/lib/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Stages where an approval is checked against the department budget. */
const BUDGET_CHECKED_STATUSES: RequestStatus[] = [
  "pending_finance_staff",
  "pending_finance_manager",
];

// The verb logged when the current owner APPROVES at each stage.
const APPROVE_VERB: Partial<Record<RequestStatus, ApprovalAction>> = {
  pending_finance_staff: "validated",
  pending_finance_manager: "final_approved",
  pending_accountant: "completed",
};

/** What the requester is told as their request advances through the chain. */
const REQUESTER_UPDATE: Partial<Record<RequestStatus, { title: string; body: string }>> = {
  pending_finance_staff: {
    title: "Your request has been submitted",
    body: "It is now with Finance Staff for review.",
  },
  pending_finance_manager: {
    title: "Your request passed Finance Staff review",
    body: "It is now waiting for Finance Manager approval.",
  },
  pending_accountant: {
    title: "Your request has been approved",
    body: "Waiting for payment processing.",
  },
  completed: {
    title: "Payment completed successfully",
    body: "The payment has been released and recorded to the ledger.",
  },
};

async function notifyRole(role: UserRole, payload: {
  title: string;
  body: string;
  link: string;
  request_id?: string | null;
  type?: "info" | "approval" | "rejection" | "payment" | "system";
}) {
  const supabase = await createClient();
  const { data: users } = await supabase.from("profiles").select("id").eq("role", role);
  if (!users?.length) return;
  await supabase.from("notifications").insert(
    users.map((u) => ({
      user_id: u.id,
      title: payload.title,
      body: payload.body,
      link: payload.link,
      request_id: payload.request_id ?? null,
      type: payload.type ?? "approval",
    })),
  );
}

async function notifyUser(userId: string, payload: {
  title: string;
  body: string;
  link: string;
  request_id?: string | null;
  type?: "info" | "approval" | "rejection" | "payment" | "system";
}) {
  const supabase = await createClient();
  await supabase.from("notifications").insert({
    user_id: userId,
    title: payload.title,
    body: payload.body,
    link: payload.link,
    request_id: payload.request_id ?? null,
    type: payload.type ?? "info",
  });
}

/**
 * The active budget a request should be charged to: the department's own
 * ceiling for the current period, falling back to the company-wide one. Set at
 * creation so the expense the Accountant records later lands on a budget and
 * `budgets.spent` actually moves.
 */
async function findBudgetFor(departmentId: string | null): Promise<string | null> {
  const supabase = await createClient();
  const department = departmentId && UUID_RE.test(departmentId) ? departmentId : null;

  // Resolved by a SECURITY DEFINER function: employees may not read the budgets
  // table, but their request still has to be charged to the right ceiling.
  const { data } = await supabase.rpc("budget_for_department", { dept: department });
  return (data as string | null) ?? null;
}

/**
 * Department budget guard. A request may only pass a finance approval stage
 * while its department's budget still covers the amount:
 *
 *   Remaining        = Allocated - Approved Expenses
 *   Approved Expenses = spent (paid and recorded)
 *                     + reserved (past final approval, awaiting payment)
 *
 * Both halves come from the `budget_status` view, so the guard and the Budgets
 * page can never disagree about what is left. Nothing is counted before the
 * Finance Manager approves — a request can still be returned or rejected up to
 * that point, so it must not hold budget down.
 *
 * Returns null when the request fits — or when no budget governs it — and
 * otherwise the figures the "Budget Validation Failed" modal needs.
 */
async function validateDepartmentBudget(request: {
  amount: number;
  budget_id: string | null;
  department_id: string | null;
}): Promise<BudgetValidation | null> {
  const supabase = await createClient();

  const budgetId = request.budget_id ?? (await findBudgetFor(request.department_id));
  if (!budgetId) return null; // nothing allocated to validate against

  const { data: budget } = await supabase
    .from("budget_status")
    .select("name, department_name, amount, spent, reserved, remaining")
    .eq("id", budgetId)
    .single();
  if (!budget) return null;

  const remaining = Number(budget.remaining);
  const requested = Number(request.amount);
  if (remaining >= requested) return null;

  return {
    departmentName: budget.department_name ?? "Company-wide",
    budgetName: budget.name,
    allocated: Number(budget.amount),
    approvedExpenses: Number(budget.spent) + Number(budget.reserved),
    remaining,
    requested,
    shortage: requested - remaining,
  };
}

/**
 * Warn the Finance Manager as soon as a budget crosses its alert threshold.
 * Reserved money counts: once a request clears final approval the budget is
 * committed, even though the Accountant has not paid it yet.
 */
async function checkBudgetAlert(budgetId: string | null) {
  if (!budgetId) return;
  const supabase = await createClient();

  const { data: budget } = await supabase
    .from("budget_status")
    .select("name, amount, spent, reserved, alert_threshold")
    .eq("id", budgetId)
    .single();
  if (!budget || Number(budget.amount) <= 0) return;

  const committed = Number(budget.spent) + Number(budget.reserved);
  const pct = Math.round((committed / Number(budget.amount)) * 100);
  if (pct < budget.alert_threshold) return;

  await notifyRole("finance_manager", {
    title: pct >= 100 ? "Budget exceeded" : "Budget nearing its limit",
    body: `"${budget.name}" is at ${pct}% of ${formatCurrency(Number(budget.amount))}.`,
    link: "/budgets",
    type: "system",
  });
}

const ATTACHMENT_BUCKET = "request-attachments";
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/**
 * Store uploaded files under `<request_id>/<file>` — the Storage policies in
 * migration 0006 read that first path segment to decide who may touch them.
 * Files that fail to upload are skipped rather than failing the whole action.
 */
async function uploadAttachments(
  requestId: string,
  files: FormDataEntryValue[],
  uploaderId: string,
) {
  const uploads = files.filter(
    (f): f is File => f instanceof File && f.size > 0 && f.size <= MAX_ATTACHMENT_BYTES,
  );
  if (uploads.length === 0) return;

  const supabase = await createClient();
  for (const file of uploads) {
    const safeName = file.name.replace(/[^\w.\-]/g, "_").slice(-80);
    const path = `${requestId}/${Date.now()}-${safeName}`;

    const { error } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) continue;

    await supabase.from("request_attachments").insert({
      request_id: requestId,
      file_name: file.name,
      file_path: path,
      file_type: file.type,
      file_size: file.size,
      kind: file.type === "application/pdf" ? "quotation" : "receipt",
      uploaded_by: uploaderId,
    });
  }
}

/**
 * Every field on the request form is mandatory, including a supporting
 * document — a reviewer should never receive a request they have to chase
 * details for. Checked here as well as in the browser, since the `required`
 * attribute only guards the happy path.
 */
function validateRequestFields(
  formData: FormData,
  type: RequestType,
  opts: { skipAttachments?: boolean } = {},
): string | null {
  const required: [string, string][] = [
    ["title", "a title"],
    ["amount", "an amount"],
    ["department_id", "a department"],
    ["category_id", "a category"],
    ["priority", "a priority"],
    ["description", "a description"],
    ["justification", "a justification"],
    type === "purchase" ? ["vendor_id", "a vendor"] : ["expense_date", "the expense date"],
  ];
  if (type === "purchase") required.push(["needed_by", "a needed-by date"]);

  for (const [field, label] of required) {
    if (!String(formData.get(field) || "").trim()) return `Please provide ${label}.`;
  }
  if (!(Number(formData.get("amount") || 0) > 0)) {
    return "Enter an amount greater than zero.";
  }
  if (!["low", "medium", "high"].includes(String(formData.get("priority")))) {
    return "Choose a valid priority.";
  }

  if (!opts.skipAttachments) {
    const files = formData
      .getAll("attachments")
      .filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) {
      return type === "purchase"
        ? "Attach a quotation or supporting document."
        : "Attach the receipt for this expense.";
    }
    if (files.some((f) => f.size > MAX_ATTACHMENT_BYTES)) {
      return "Each attachment must be 10 MB or smaller.";
    }
  }

  return null;
}

/** Create a new purchase or reimbursement request and start the workflow. */
export async function createRequest(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const type = (formData.get("type") as RequestType) || "purchase";
  const problem = validateRequestFields(formData, type);
  if (problem) return { error: problem };

  const title = String(formData.get("title") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  const department_id = (formData.get("department_id") as string) || profile.department_id || null;
  const category_id = (formData.get("category_id") as string) || null;
  const vendor_id = (formData.get("vendor_id") as string) || null;
  const priority = (formData.get("priority") as string) || "medium";
  const description = String(formData.get("description") || "").trim() || null;
  const justification = String(formData.get("justification") || "").trim() || null;
  const needed_by = (formData.get("needed_by") as string) || null;
  const expense_date = (formData.get("expense_date") as string) || null;
  const budget_id = await findBudgetFor(department_id);

  const { data: created, error } = await supabase
    .from("requests")
    .insert({
      type,
      title,
      description,
      justification,
      requester_id: profile.id,
      department_id,
      category_id: category_id || null,
      vendor_id: vendor_id || null,
      budget_id,
      amount,
      priority,
      needed_by: needed_by || null,
      expense_date: expense_date || null,
      status: "pending_finance_staff",
    })
    .select("id, request_no")
    .single();

  if (error || !created) return { error: error?.message || "Could not create request." };

  await supabase.from("request_approvals").insert({
    request_id: created.id,
    actor_id: profile.id,
    action: "submitted",
    role_at_action: profile.role,
    from_status: "draft",
    to_status: "pending_finance_staff",
    remarks: "Submitted for review.",
  });

  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "created",
    entity_type: "requests",
    entity_id: created.id,
    description: `Created ${type} request ${created.request_no} — ${title}`,
  });

  await uploadAttachments(created.id, formData.getAll("attachments"), profile.id);

  await notifyUser(profile.id, {
    title: "Your request has been submitted",
    body: `${created.request_no} — It is now with Finance Staff for review.`,
    link: `/requests/${created.id}`,
    request_id: created.id,
    type: "info",
  });

  await notifyRole("finance_staff", {
    title: "New request submitted",
    body: `${profile.full_name} submitted "${title}".`,
    link: "/approvals",
    request_id: created.id,
  });

  revalidatePath("/approvals");
  redirect(type === "reimbursement" ? "/reimbursements" : "/purchase-requests");
}

/**
 * Advance a request through the workflow. `decision` is approve | return | reject.
 * On approval the request moves to the next stage and the next role is notified;
 * this is the hand-off that makes each user's task depend on the previous user.
 *
 * Approving at either finance stage first runs the department budget check. If
 * the department cannot afford it nothing is written: the status, the workflow
 * position and the budget are all left exactly as they were.
 */
export async function actOnRequest(_prev: ApprovalState, formData: FormData): Promise<ApprovalState> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const requestId = String(formData.get("request_id") || "");
  const decision = String(formData.get("decision") || "approve");
  const remarks = String(formData.get("remarks") || "").trim() || null;

  const { data: reqRow } = await supabase
    .from("requests")
    .select("id, request_no, title, amount, status, requester_id, department_id, category_id, budget_id")
    .eq("id", requestId)
    .single();
  if (!reqRow) return { error: "Request not found." };

  const current = reqRow.status as RequestStatus;
  if (!canActOn(current, profile.role)) {
    return { error: "You are not authorized to act on this request at its current stage." };
  }

  // Returning or rejecting must always carry a reason — the requester needs to
  // know what to fix, and a rejection is permanent.
  if (remarksRequired(decision) && !remarks) {
    return {
      error:
        decision === "return"
          ? "Remarks are required — tell the requester what needs to be revised."
          : "Remarks are required — state why this request is being rejected.",
    };
  }

  // Budget gate — only on approval, and only at the two finance stages. By the
  // time the Accountant pays, the spending decision has already been made.
  if (decision === "approve" && BUDGET_CHECKED_STATUSES.includes(current)) {
    const failure = await validateDepartmentBudget({
      amount: Number(reqRow.amount),
      budget_id: reqRow.budget_id,
      department_id: reqRow.department_id,
    });
    if (failure) {
      // Record the attempt only — no status change, no budget movement.
      await supabase.from("audit_logs").insert({
        actor_id: profile.id,
        action: "budget_blocked",
        entity_type: "requests",
        entity_id: requestId,
        description:
          `Blocked ${reqRow.request_no}: ${formatCurrency(failure.requested)} exceeds the ` +
          `${failure.departmentName} remaining budget of ${formatCurrency(failure.remaining)} ` +
          `(short ${formatCurrency(failure.shortage)})`,
      });
      return { budgetBlock: failure };
    }
  }

  let newStatus: RequestStatus;
  let action: ApprovalAction;

  if (decision === "reject") {
    newStatus = "rejected";
    action = "rejected";
  } else if (decision === "return") {
    newStatus = "returned";
    action = "returned";
  } else {
    newStatus = nextStatus(current) ?? "completed";
    action = APPROVE_VERB[current] ?? "validated";
  }

  await supabase.from("requests").update({ status: newStatus }).eq("id", requestId);

  await supabase.from("request_approvals").insert({
    request_id: requestId,
    actor_id: profile.id,
    action,
    role_at_action: profile.role,
    from_status: current,
    to_status: newStatus,
    remarks,
  });

  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action,
    entity_type: "requests",
    entity_id: requestId,
    description: `${action.replace(/_/g, " ")} request ${reqRow.request_no}`,
  });

  // Final approval is the moment the money is committed: the request now counts
  // as `reserved` against its budget (see the budget_status view) and remaining
  // budget drops accordingly. Until this point it held nothing, because it could
  // still have been returned or rejected.
  if (decision === "approve" && current === "pending_finance_manager") {
    await supabase.from("audit_logs").insert({
      actor_id: profile.id,
      action: "budget_reserved",
      entity_type: "requests",
      entity_id: requestId,
      description: `Reserved ${formatCurrency(Number(reqRow.amount))} against the budget for ${reqRow.request_no}`,
    });
    await checkBudgetAlert(reqRow.budget_id);
  }

  // When the Accountant completes the request, the payment is released and the
  // transaction is recorded to the ledger in one step. The reservation is
  // released at the same instant the expense lands, so remaining does not move
  // twice for the same request.
  if (decision === "approve" && current === "pending_accountant") {
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from("payments").insert({
      request_id: requestId,
      amount: reqRow.amount,
      method: "bank_transfer",
      status: "paid",
      scheduled_date: today,
      paid_at: new Date().toISOString(),
      processed_by: profile.id,
    });
    await supabase.from("expenses").insert({
      request_id: requestId,
      description: reqRow.title,
      category_id: reqRow.category_id,
      department_id: reqRow.department_id,
      budget_id: reqRow.budget_id,
      amount: reqRow.amount,
      expense_date: today,
      payment_status: "paid",
      recorded_by: profile.id,
    });
    // The expense trigger has just moved budgets.spent — tell the Finance
    // Manager if that pushed the budget past its alert threshold.
    await checkBudgetAlert(reqRow.budget_id);
  }

  // Keep the requester informed at every stage, and hand the baton to whoever
  // acts next.
  const link = `/requests/${requestId}`;

  if (newStatus === "returned") {
    await notifyUser(reqRow.requester_id, {
      title: "Your request requires revision",
      body: `${reqRow.request_no} — Reason: ${remarks}`,
      link,
      request_id: requestId,
      type: "rejection",
    });
  } else if (newStatus === "rejected") {
    await notifyUser(reqRow.requester_id, {
      title: "Your request has been rejected",
      body: `${reqRow.request_no} — Reason: ${remarks}`,
      link,
      request_id: requestId,
      type: "rejection",
    });
  } else {
    await notifyUser(reqRow.requester_id, {
      title: REQUESTER_UPDATE[newStatus]?.title ?? "Your request was updated",
      body: `${reqRow.request_no} — ${REQUESTER_UPDATE[newStatus]?.body ?? reqRow.title}`,
      link,
      request_id: requestId,
      type: newStatus === "completed" ? "payment" : "info",
    });

    const nextOwner = STATUS_META[newStatus]?.ownerRole;
    if (nextOwner && nextOwner !== "employee") {
      await notifyRole(nextOwner, {
        title: "A request needs your action",
        body: `"${reqRow.title}" advanced to ${STATUS_META[newStatus].label}.`,
        link: "/approvals",
        request_id: requestId,
        type: newStatus === "pending_accountant" ? "payment" : "approval",
      });
    }
  }

  revalidatePath("/approvals");
  revalidatePath("/dashboard");
  revalidatePath("/payments");
  revalidatePath("/expenses");
  revalidatePath("/budgets");
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Returned workflow — a returned request is never a dead record
// -----------------------------------------------------------------------------

/**
 * Revise a returned (or draft) request. The requester may change the content
 * fields; the request number, department and requester are fixed for the life
 * of the request, so they are never read from the form.
 */
export async function updateRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const requestId = String(formData.get("request_id") || "");
  const { data: reqRow } = await supabase
    .from("requests")
    .select("id, request_no, type, status, requester_id")
    .eq("id", requestId)
    .single();
  if (!reqRow) return { error: "Request not found." };

  if (reqRow.requester_id !== profile.id) {
    return { error: "Only the requester can edit this request." };
  }
  if (!isEditable(reqRow.status as RequestStatus)) {
    return {
      error:
        reqRow.status === "rejected"
          ? "This request was rejected and cannot be edited. Create a new request instead."
          : "This request can only be edited while it is returned to you.",
    };
  }

  // Same completeness rules as a new request, except that attachments already
  // on the request count — a revision need not re-upload them.
  const { count } = await supabase
    .from("request_attachments")
    .select("id", { count: "exact", head: true })
    .eq("request_id", requestId);
  const uploading = formData
    .getAll("attachments")
    .filter((f): f is File => f instanceof File && f.size > 0);

  const problem = validateRequestFields(formData, reqRow.type as RequestType, {
    skipAttachments: (count ?? 0) > 0,
  });
  if (problem) return { error: problem };

  const title = String(formData.get("title") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  if (uploading.some((f) => f.size > MAX_ATTACHMENT_BYTES)) {
    return { error: "Each attachment must be 10 MB or smaller." };
  }

  const { error } = await supabase
    .from("requests")
    .update({
      title,
      description: String(formData.get("description") || "").trim() || null,
      justification: String(formData.get("justification") || "").trim() || null,
      category_id: (formData.get("category_id") as string) || null,
      vendor_id: (formData.get("vendor_id") as string) || null,
      amount,
      needed_by: (formData.get("needed_by") as string) || null,
      expense_date: (formData.get("expense_date") as string) || null,
    })
    .eq("id", requestId);
  if (error) return { error: error.message };

  await uploadAttachments(requestId, formData.getAll("attachments"), profile.id);

  await supabase.from("request_approvals").insert({
    request_id: requestId,
    actor_id: profile.id,
    action: "edited",
    role_at_action: profile.role,
    from_status: reqRow.status,
    to_status: reqRow.status,
    remarks: "Request details revised.",
  });

  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "edited",
    entity_type: "requests",
    entity_id: requestId,
    description: `Edited request ${reqRow.request_no}`,
  });

  revalidatePath(`/requests/${requestId}`);
  redirect(`/requests/${requestId}`);
}

/** Send a revised request back to Finance Staff — Returned becomes Submitted. */
export async function resubmitRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const requestId = String(formData.get("request_id") || "");
  const { data: reqRow } = await supabase
    .from("requests")
    .select("id, request_no, title, status, requester_id")
    .eq("id", requestId)
    .single();
  if (!reqRow) return { error: "Request not found." };
  if (reqRow.requester_id !== profile.id) {
    return { error: "Only the requester can resubmit this request." };
  }
  if (reqRow.status !== "returned") {
    return { error: "Only a returned request can be resubmitted." };
  }

  await supabase
    .from("requests")
    .update({ status: "pending_finance_staff" })
    .eq("id", requestId);

  await supabase.from("request_approvals").insert({
    request_id: requestId,
    actor_id: profile.id,
    action: "resubmitted",
    role_at_action: profile.role,
    from_status: "returned",
    to_status: "pending_finance_staff",
    remarks: String(formData.get("remarks") || "").trim() || "Revised and resubmitted.",
  });

  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "resubmitted",
    entity_type: "requests",
    entity_id: requestId,
    description: `Resubmitted request ${reqRow.request_no}`,
  });

  await notifyRole("finance_staff", {
    title: "A returned request was resubmitted",
    body: `${profile.full_name} revised and resubmitted "${reqRow.title}".`,
    link: "/approvals",
    request_id: requestId,
  });

  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/approvals");
  return { ok: true };
}

/** Withdraw a request that nobody has reviewed yet. */
export async function cancelRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const requestId = String(formData.get("request_id") || "");
  const { data: reqRow } = await supabase
    .from("requests")
    .select("id, request_no, status, requester_id")
    .eq("id", requestId)
    .single();
  if (!reqRow) return { error: "Request not found." };

  const admin = isAdmin(profile.role);
  if (reqRow.requester_id !== profile.id && !admin) {
    return { error: "Only the requester or an Administrator can cancel this request." };
  }

  // The requester may withdraw only before anyone has reviewed it. An
  // Administrator oversees the whole process and may pull any request that has
  // not already closed.
  const cancellable = admin
    ? !isClosed(reqRow.status as RequestStatus)
    : ["pending_finance_staff", "draft", "returned"].includes(reqRow.status);
  if (!cancellable) {
    return {
      error: admin
        ? "This request is already closed."
        : "This request has already been reviewed and can no longer be cancelled.",
    };
  }

  await supabase.from("requests").update({ status: "cancelled" }).eq("id", requestId);

  await supabase.from("request_approvals").insert({
    request_id: requestId,
    actor_id: profile.id,
    action: "cancelled",
    role_at_action: profile.role,
    from_status: reqRow.status,
    to_status: "cancelled",
    remarks:
      String(formData.get("remarks") || "").trim() ||
      (admin && reqRow.requester_id !== profile.id
        ? "Cancelled by an Administrator."
        : "Withdrawn by the requester."),
  });

  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "cancelled",
    entity_type: "requests",
    entity_id: requestId,
    description: `Cancelled request ${reqRow.request_no}`,
  });

  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/approvals");
  return { ok: true };
}

/** Remove an attachment from a request the requester may still edit. */
export async function deleteAttachment(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const id = String(formData.get("attachment_id") || "");
  const { data: attachment } = await supabase
    .from("request_attachments")
    .select("id, file_path, request_id, request:requests(status, requester_id)")
    .eq("id", id)
    .single();
  if (!attachment) return { error: "Attachment not found." };

  const parent = attachment.request as unknown as { status: RequestStatus; requester_id: string };
  if (parent.requester_id !== profile.id || !isEditable(parent.status)) {
    return { error: "You cannot remove this attachment." };
  }

  await supabase.storage.from(ATTACHMENT_BUCKET).remove([attachment.file_path]);
  await supabase.from("request_attachments").delete().eq("id", id);

  revalidatePath(`/requests/${attachment.request_id}`);
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Master data — vendors
// -----------------------------------------------------------------------------

/** Shared field rules for the vendor form, mirroring the client sanitizers. */
function validateVendorFields(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const contact_person = String(formData.get("contact_person") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const phone = String(formData.get("phone") || "").trim();
  const tin = String(formData.get("tin") || "").trim();

  if (!name) return { error: "The vendor name is required." };
  if (!hasLetter(name)) return { error: "The vendor name must contain letters." };
  if (name !== sanitizeCompanyName(name)) {
    return { error: "The vendor name may only use letters, numbers and . , & - ' ( )." };
  }
  if (contact_person && contact_person !== sanitizePersonName(contact_person)) {
    return { error: "The contact person may only contain letters — no digits or symbols." };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }
  // Human separators are accepted and normalised away, so a number saved as
  // "+63 2 8555 0100" or a TIN as "345-678-901-000" stays editable.
  const contactNumber = normalizeContactNumber(phone);
  if (contactNumber.error) return { error: contactNumber.error };
  const taxNumber = normalizeTin(tin);
  if (taxNumber.error) return { error: taxNumber.error };

  return {
    values: {
      name,
      contact_person: contact_person || null,
      email: email || null,
      phone: contactNumber.value,
      tin: taxNumber.value,
      address: String(formData.get("address") || "").trim() || null,
    },
  };
}

/** Replace a vendor's category links with the ones ticked on the form. */
async function setVendorCategories(vendorId: string, categoryIds: string[]) {
  const supabase = await createClient();
  await supabase.from("vendor_categories").delete().eq("vendor_id", vendorId);
  const rows = categoryIds
    .filter((id) => UUID_RE.test(id))
    .map((category_id) => ({ vendor_id: vendorId, category_id }));
  if (rows.length) await supabase.from("vendor_categories").insert(rows);
}

/** Add a supplier so it can be picked on purchase requests. */
export async function createVendor(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireProfile();
  if (!canManageVendors(profile.role)) {
    return { error: "Only Finance Staff, the Finance Manager or an Administrator can add vendors." };
  }
  const supabase = await createClient();

  const checked = validateVendorFields(formData);
  if (checked.error) return { error: checked.error };
  const values = checked.values!;

  // Vendor names are not unique in the schema, so guard against duplicates here
  // rather than letting two "OfficeWarehouse Corp." rows confuse the dropdown.
  const { data: existing } = await supabase
    .from("vendors").select("id").ilike("name", values.name).limit(1);
  if (existing?.length) return { error: `"${values.name}" is already on the vendor list.` };

  const { data: vendor, error } = await supabase
    .from("vendors")
    .insert({ ...values, is_active: true })
    .select("id")
    .single();
  if (error || !vendor) return { error: error?.message ?? "Could not save the vendor." };

  await setVendorCategories(vendor.id, formData.getAll("category_ids").map(String));

  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "created",
    entity_type: "vendors",
    entity_id: vendor.id,
    description: `Added vendor "${values.name}"`,
  });

  revalidatePath("/vendors");
  revalidatePath("/purchase-requests/new");
  return { ok: true };
}

/** Edit a vendor's details and the categories it supplies. */
export async function updateVendor(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireProfile();
  if (!canManageVendors(profile.role)) {
    return { error: "You cannot change the vendor list." };
  }
  const supabase = await createClient();

  const id = String(formData.get("vendor_id") || "");
  if (!UUID_RE.test(id)) return { error: "Vendor not found." };

  const checked = validateVendorFields(formData);
  if (checked.error) return { error: checked.error };
  const values = checked.values!;

  const { data: clash } = await supabase
    .from("vendors").select("id").ilike("name", values.name).neq("id", id).limit(1);
  if (clash?.length) return { error: `"${values.name}" is already on the vendor list.` };

  const { error } = await supabase.from("vendors").update(values).eq("id", id);
  if (error) return { error: error.message };

  await setVendorCategories(id, formData.getAll("category_ids").map(String));

  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "updated",
    entity_type: "vendors",
    entity_id: id,
    description: `Updated vendor "${values.name}"`,
  });

  revalidatePath("/vendors");
  revalidatePath("/purchase-requests/new");
  return { ok: true };
}

/**
 * Retire or restore a vendor. Rows are never deleted — past requests and
 * expenses reference them, so an inactive vendor simply drops out of the
 * dropdowns while its history stays intact.
 */
export async function setVendorActive(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireProfile();
  if (!canManageVendors(profile.role)) {
    return { error: "You cannot change the vendor list." };
  }
  const supabase = await createClient();

  const id = String(formData.get("vendor_id") || "");
  const active = String(formData.get("active") || "") === "true";

  const { data: vendor } = await supabase.from("vendors").select("name").eq("id", id).single();
  if (!vendor) return { error: "Vendor not found." };

  const { error } = await supabase.from("vendors").update({ is_active: active }).eq("id", id);
  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: active ? "updated" : "deactivated",
    entity_type: "vendors",
    entity_id: id,
    description: `${active ? "Reactivated" : "Deactivated"} vendor "${vendor.name}"`,
  });

  revalidatePath("/vendors");
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Ledger — income
// -----------------------------------------------------------------------------

/**
 * Record money coming in. Expenses reach the ledger automatically when the
 * Accountant completes a request, but income has no request behind it — it is
 * posted directly.
 */
export async function createIncome(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireProfile();
  if (!canRecordIncome(profile.role)) {
    return { error: "Only finance roles can record income." };
  }
  const supabase = await createClient();

  const source = String(formData.get("source") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  const received_date = String(formData.get("received_date") || "").trim();
  if (!source) return { error: "Say where the income came from." };
  if (!(amount > 0)) return { error: "The amount must be greater than zero." };
  if (!received_date) return { error: "Pick the date it was received." };

  const { data: income, error } = await supabase
    .from("income")
    .insert({
      source,
      description: String(formData.get("description") || "").trim() || null,
      category_id: (formData.get("category_id") as string) || null,
      account_id: (formData.get("account_id") as string) || null,
      department_id: (formData.get("department_id") as string) || null,
      amount,
      received_date,
      recorded_by: profile.id,
    })
    .select("id, reference_no")
    .single();
  if (error || !income) return { error: error?.message ?? "Could not record the income." };

  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "created",
    entity_type: "income",
    entity_id: income.id,
    description: `Recorded income ${income.reference_no} — ${formatCurrency(amount)} from ${source}`,
  });

  revalidatePath("/income");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Administration — user accounts
// -----------------------------------------------------------------------------

/**
 * Create a sign-in account plus its profile. Only an Administrator may do this.
 * The auth user is created with the service-role key; the `handle_new_user`
 * trigger then writes the matching `profiles` row from the metadata below and
 * this action fills in the fields the trigger does not know about.
 */
export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireProfile();
  if (!isAdmin(profile.role)) {
    return { error: "Only an Administrator can add users." };
  }

  const full_name = String(formData.get("full_name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "employee") as UserRole;
  const employee_no = String(formData.get("employee_no") || "").trim() || null;
  const department_id = String(formData.get("department_id") || "") || null;
  const position = String(formData.get("position") || "").trim() || null;
  const phone = String(formData.get("phone") || "").trim() || null;

  if (!full_name) return { error: "Full name is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "The temporary password must be at least 8 characters." };
  if (!ALL_ROLES.includes(role)) return { error: "Unknown role." };

  const admin = createAdminClient();

  // Check the two unique columns up front so we never leave a half-created
  // account behind on a constraint violation.
  const { data: emailTaken } = await admin
    .from("profiles").select("id").eq("email", email).limit(1);
  if (emailTaken?.length) return { error: `${email} is already registered.` };

  if (employee_no) {
    const { data: numberTaken } = await admin
      .from("profiles").select("id").eq("employee_no", employee_no).limit(1);
    if (numberTaken?.length) return { error: `Employee number ${employee_no} is already assigned.` };
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // no inbox in the demo environment — usable immediately
    user_metadata: { full_name, role, employee_no },
  });
  if (error || !created?.user) {
    const message = error?.message ?? "Could not create the account.";
    return { error: /already/i.test(message) ? `${email} is already registered.` : message };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ full_name, email, role, employee_no, department_id, position, phone })
    .eq("id", created.user.id);
  if (profileError) {
    // Roll the auth user back so a retry starts from a clean slate.
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: profileError.message };
  }

  await admin.from("audit_logs").insert({
    actor_id: profile.id,
    action: "created",
    entity_type: "profiles",
    entity_id: created.user.id,
    description: `Created ${roleName(role)} account for ${full_name} (${email})`,
  });

  await admin.from("notifications").insert({
    user_id: created.user.id,
    title: "Welcome to Fagle FMS",
    body: `Your ${roleName(role)} account is ready. Please change your temporary password after signing in.`,
    link: "/profile",
    type: "system",
  });

  revalidatePath("/users");
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Budgeting — the Finance Manager sets ceilings, Finance Staff allocates
// -----------------------------------------------------------------------------

/**
 * Set a budget ceiling for a department (or company-wide) for one period.
 * Restricted to the Finance Manager: budgets are the spending authority every
 * later approval is checked against, so one owner holds the pen.
 */
export async function createBudget(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireProfile();
  if (!canManageBudgets(profile.role)) {
    return { error: "Only the Finance Manager can set budgets." };
  }
  const supabase = await createClient();

  const name = String(formData.get("name") || "").trim();
  const period = (formData.get("period") as BudgetPeriod) || "monthly";
  const fiscal_year = Number(formData.get("fiscal_year") || 0);
  const period_index = Number(formData.get("period_index") || 1);
  const amount = Number(formData.get("amount") || 0);
  const alert_threshold = Number(formData.get("alert_threshold") || 80);
  const department_id = String(formData.get("department_id") || "") || null;

  if (!name) return { error: "Give the budget a name." };
  if (!["monthly", "quarterly", "yearly"].includes(period)) return { error: "Unknown budget period." };
  if (fiscal_year < 2000 || fiscal_year > 2100) return { error: "Enter a valid fiscal year." };
  if (!(amount > 0)) return { error: "The budget amount must be greater than zero." };
  if (alert_threshold < 1 || alert_threshold > 100) {
    return { error: "The alert threshold must be between 1 and 100 percent." };
  }

  const { start, end } = periodRange(period, fiscal_year, period_index);

  // One ceiling per scope per period — otherwise spending is charged to
  // whichever duplicate happens to sort first.
  const duplicateQuery = supabase
    .from("budgets")
    .select("id")
    .eq("fiscal_year", fiscal_year)
    .eq("period", period)
    .eq("start_date", start)
    .limit(1);
  const { data: duplicate } = department_id
    ? await duplicateQuery.eq("department_id", department_id)
    : await duplicateQuery.is("department_id", null);
  if (duplicate?.length) {
    return { error: "A budget already covers that scope and period. Adjust the existing one instead." };
  }

  const { data: budget, error } = await supabase
    .from("budgets")
    .insert({
      name,
      department_id,
      period,
      fiscal_year,
      amount,
      start_date: start,
      end_date: end,
      alert_threshold,
      status: "active",
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error || !budget) return { error: error?.message ?? "Could not save the budget." };

  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "created",
    entity_type: "budgets",
    entity_id: budget.id,
    description: `Set ${period} budget "${name}" at ${formatCurrency(amount)} for FY${fiscal_year}`,
  });

  // Hand off to the second budget owner: Finance Staff can now draw from it.
  await notifyRole("finance_staff", {
    title: "A new budget is available",
    body: `${profile.full_name} set "${name}" at ${formatCurrency(amount)}. You can now allocate against it.`,
    link: "/budgets",
    type: "info",
  });

  revalidatePath("/budgets");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Reserve part of an existing ceiling for a specific purpose. Finance Staff do
 * this day to day; the Finance Manager can too. A trigger keeps
 * `budgets.allocated` in step with these rows.
 */
export async function allocateBudget(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireProfile();
  if (!canAllocateBudget(profile.role)) {
    return { error: "Only Finance Staff or the Finance Manager can allocate a budget." };
  }
  const supabase = await createClient();

  const budget_id = String(formData.get("budget_id") || "");
  const amount = Number(formData.get("amount") || 0);
  const allocated_to = String(formData.get("allocated_to") || "").trim() || null;
  const note = String(formData.get("note") || "").trim() || null;

  if (!budget_id) return { error: "Pick a budget to allocate from." };
  if (!(amount > 0)) return { error: "The allocation must be greater than zero." };
  if (!allocated_to) return { error: "Say what this allocation is for." };

  const { data: budget } = await supabase
    .from("budgets")
    .select("id, name, amount, allocated, status")
    .eq("id", budget_id)
    .single();
  if (!budget) return { error: "That budget no longer exists." };
  if (budget.status !== "active") return { error: "That budget is closed." };

  const remaining = Number(budget.amount) - Number(budget.allocated);
  if (amount > remaining) {
    return { error: `Only ${formatCurrency(remaining)} is left to allocate from "${budget.name}".` };
  }

  const { error } = await supabase.from("budget_allocations").insert({
    budget_id,
    amount,
    allocated_to,
    note,
    created_by: profile.id,
  });
  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "allocated",
    entity_type: "budgets",
    entity_id: budget_id,
    description: `Allocated ${formatCurrency(amount)} from "${budget.name}"${allocated_to ? ` to ${allocated_to}` : ""}`,
  });

  await notifyRole("finance_manager", {
    title: "Budget allocation recorded",
    body: `${profile.full_name} allocated ${formatCurrency(amount)} from "${budget.name}".`,
    link: "/budgets",
    type: "info",
  });

  revalidatePath("/budgets");
  return { ok: true };
}

/** Mark a single notification as read. */
export async function markNotificationRead(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  revalidatePath("/notifications");
}

/** Mark all of the current user's notifications as read. */
export async function markAllNotificationsRead() {
  const profile = await requireProfile();
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", profile.id)
    .eq("is_read", false);
  revalidatePath("/notifications");
}
