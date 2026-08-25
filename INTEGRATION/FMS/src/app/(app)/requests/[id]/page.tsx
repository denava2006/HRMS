import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, CornerUpLeft, Paperclip } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isAdmin, roleName } from "@/lib/rbac";
import { isClosed, STATUS_META } from "@/lib/workflow";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import { WorkflowTimeline } from "@/components/workflow-timeline";
import { RequestHistory } from "@/components/request-history";
import { ReturnedActions, CancelRequestButton } from "@/components/requester-actions";
import type { FinanceRequest, RequestApproval, UserRole } from "@/lib/types";

type Approval = RequestApproval & { actor?: { full_name: string; role: UserRole } | null };

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  // RLS limits this to the requester and reviewers — anyone else gets nothing.
  const { data } = await supabase
    .from("requests")
    .select(
      "*, requester:profiles!requests_requester_id_fkey(full_name, position), department:departments(name), category:categories(name), vendor:vendors(name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  const request = data as FinanceRequest & {
    requester?: { full_name: string; position: string | null };
    department?: { name: string };
    category?: { name: string };
    vendor?: { name: string };
  };

  const [{ data: historyRows }, { data: attachmentRows }] = await Promise.all([
    supabase
      .from("request_approvals")
      .select("*, actor:profiles(full_name, role)")
      .eq("request_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("request_attachments")
      .select("id, file_name, file_path, file_size")
      .eq("request_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const history = (historyRows ?? []) as Approval[];
  const attachments = (attachmentRows ?? []) as {
    id: string;
    file_name: string;
    file_path: string;
    file_size: number | null;
  }[];

  // The bucket is private, so hand out short-lived signed links.
  const signed = await Promise.all(
    attachments.map(async (a) => {
      const { data: url } = await supabase.storage
        .from("request-attachments")
        .createSignedUrl(a.file_path, 60 * 10);
      return { ...a, url: url?.signedUrl ?? null };
    }),
  );

  const isOwner = request.requester_id === profile.id;
  const lastReturn = [...history].reverse().find((h) => h.action === "returned");
  const lastReject = [...history].reverse().find((h) => h.action === "rejected");
  const backHref = request.type === "reimbursement" ? "/reimbursements" : "/purchase-requests";

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-brand-600 dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {request.type === "reimbursement" ? "Reimbursements" : "Purchase Requests"}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-slate-400">{request.request_no}</span>
          <StatusBadge status={request.status} />
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {request.type}
          </span>
        </div>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100 sm:text-2xl">
          {request.title}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {STATUS_META[request.status].description}
        </p>
      </div>

      {/* Returned — editable and resubmittable, never a dead record. */}
      {request.status === "returned" && (
        <div className="glass-card border-l-4 border-l-amber-500 p-5">
          <div className="mb-3 flex items-center gap-2 text-amber-600 dark:text-amber-300">
            <CornerUpLeft className="h-4 w-4" />
            <h2 className="text-sm font-semibold">This request was returned for revision</h2>
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
            <Field label="Status" value="Returned" />
            <Field
              label="Returned By"
              value={
                lastReturn?.role_at_action
                  ? roleName(lastReturn.role_at_action)
                  : lastReturn?.actor?.full_name ?? "Finance Staff"
              }
            />
            <Field label="Returned" value={formatDate(lastReturn?.created_at ?? request.updated_at)} />
          </dl>
          <div className="mt-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Remarks</p>
            <p className="mt-0.5 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
              {lastReturn?.remarks ?? "No remarks were recorded."}
            </p>
          </div>
          {isOwner && (
            <div className="mt-4 border-t border-slate-200/60 pt-4 dark:border-slate-700/60">
              <ReturnedActions requestId={request.id} />
            </div>
          )}
        </div>
      )}

      {/* Rejected — permanent. View only. */}
      {request.status === "rejected" && (
        <div className="glass-card border-l-4 border-l-rose-500 p-5">
          <div className="mb-3 flex items-center gap-2 text-rose-600 dark:text-rose-300">
            <Ban className="h-4 w-4" />
            <h2 className="text-sm font-semibold">This request was rejected</h2>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Reason</p>
            <p className="mt-0.5 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-200">
              {lastReject?.remarks ?? "No reason was recorded."}
            </p>
          </div>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            A rejection is final — this request cannot be edited or resubmitted.
            {isOwner && (
              <>
                {" "}
                If you still need the purchase,{" "}
                <Link
                  href={request.type === "reimbursement" ? "/reimbursements/new" : "/purchase-requests/new"}
                  className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                >
                  create a new request
                </Link>
                .
              </>
            )}
          </p>
        </div>
      )}

      <div className="glass-card p-5">
        <WorkflowTimeline status={request.status} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="glass-card p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Details</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <Field label="Amount" value={formatCurrency(Number(request.amount))} strong />
            <Field label="Request No." value={request.request_no ?? "—"} />
            <Field label="Requester" value={request.requester?.full_name ?? "—"} />
            <Field label="Department" value={request.department?.name ?? "—"} />
            <Field label="Category" value={request.category?.name ?? "—"} />
            <Field label="Vendor" value={request.vendor?.name ?? "—"} />
            <Field label="Priority" value={request.priority} />
            {request.needed_by && <Field label="Needed By" value={formatDate(request.needed_by)} />}
            {request.expense_date && (
              <Field label="Expense Date" value={formatDate(request.expense_date)} />
            )}
            <Field label="Submitted" value={formatDate(request.created_at)} />
          </dl>

          <div className="mt-4 space-y-3 border-t border-slate-200/60 pt-4 dark:border-slate-700/60">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Description</p>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                {request.description || "No description provided."}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Justification</p>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                {request.justification || "No justification provided."}
              </p>
            </div>
          </div>

          <div className="mt-4 border-t border-slate-200/60 pt-4 dark:border-slate-700/60">
            <p className="mb-2 text-[11px] uppercase tracking-wide text-slate-400">Attachments</p>
            {signed.length === 0 ? (
              <p className="text-sm text-slate-400">No documents attached.</p>
            ) : (
              <ul className="space-y-1.5">
                {signed.map((a) => (
                  <li key={a.id}>
                    <a
                      href={a.url ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-brand-600 hover:underline dark:text-brand-400"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      {a.file_name}
                      {a.file_size && (
                        <span className="text-xs text-slate-400">
                          ({Math.round(a.file_size / 1024)} KB)
                        </span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* The requester may withdraw only before Finance Staff picks it up;
              an Administrator may pull any request that is still open. */}
          {((isOwner && request.status === "pending_finance_staff") ||
            (isAdmin(profile.role) && !isClosed(request.status))) && (
            <div className="mt-4 border-t border-slate-200/60 pt-4 dark:border-slate-700/60">
              <CancelRequestButton requestId={request.id} />
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Timeline</h2>
          <RequestHistory
            entries={history}
            status={request.status}
            completedAt={request.updated_at}
          />
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-slate-400">{label}</dt>
      <dd
        className={`capitalize ${strong ? "text-base font-semibold text-slate-800 dark:text-slate-100" : "text-sm text-slate-600 dark:text-slate-300"}`}
      >
        {value}
      </dd>
    </div>
  );
}
