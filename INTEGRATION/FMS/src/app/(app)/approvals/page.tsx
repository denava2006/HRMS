import { CheckCircle2 } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isAdmin, isReviewer } from "@/lib/rbac";
import { canActOn, isActingForOthers, STATUS_META, WORKFLOW } from "@/lib/workflow";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { WorkflowTimeline } from "@/components/workflow-timeline";
import { ApprovalActions } from "@/components/approval-actions";
import { redirect } from "next/navigation";
import type { FinanceRequest } from "@/lib/types";

export default async function ApprovalsPage() {
  const profile = await requireProfile();
  if (!isReviewer(profile.role)) redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase
    .from("requests")
    .select("*, requester:profiles!requests_requester_id_fkey(full_name, position), department:departments(name), category:categories(name), vendor:vendors(name)")
    .order("created_at", { ascending: true });

  const all = (data ?? []) as (FinanceRequest & {
    requester?: { full_name: string; position: string | null };
    department?: { name: string };
    category?: { name: string };
    vendor?: { name: string };
  })[];

  const queue = all.filter((r) => canActOn(r.status, profile.role));

  return (
    <div>
      <PageHeader
        title="Approvals"
        description={
          isAdmin(profile.role)
            ? "Every open request in the system. As Administrator you can act at any stage — the budget rules still apply."
            : "Requests waiting on your action. Approving hands the request to the next stage automatically."
        }
      />

      {queue.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            You&apos;re all caught up
          </p>
          <p className="mt-1 text-sm text-slate-400">
            No requests are waiting on you right now.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {queue.map((r) => {
            const step = WORKFLOW.find((s) => s.status === r.status);
            return (
              <div key={r.id} className="glass-card p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-slate-400">{r.request_no}</span>
                      <StatusBadge status={r.status} />
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {r.type}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                      {r.title}
                    </h3>
                    <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                      {r.description || "No description provided."}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-4">
                      <Detail label="Amount" value={formatCurrency(Number(r.amount))} strong />
                      <Detail label="Requester" value={r.requester?.full_name ?? "—"} />
                      <Detail label="Department" value={r.department?.name ?? "—"} />
                      <Detail label="Category" value={r.category?.name ?? "—"} />
                      {r.vendor?.name && <Detail label="Vendor" value={r.vendor.name} />}
                      {r.needed_by && <Detail label="Needed by" value={formatDate(r.needed_by)} />}
                      <Detail label="Submitted" value={formatDate(r.created_at)} />
                    </div>
                    {r.justification && (
                      <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                        <span className="font-medium">Justification:</span> {r.justification}
                      </p>
                    )}
                  </div>

                  <div className="lg:w-80 lg:shrink-0">
                    <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                      {isActingForOthers(r.status, profile.role) ? (
                        <>
                          Acting as Administrator · stage owner:{" "}
                          <span className="capitalize">
                            {STATUS_META[r.status].ownerRole?.replace(/_/g, " ")}
                          </span>
                        </>
                      ) : (
                        <>
                          Your action as{" "}
                          <span className="capitalize">
                            {STATUS_META[r.status].ownerRole?.replace(/_/g, " ")}
                          </span>
                        </>
                      )}
                    </p>
                    <ApprovalActions requestId={r.id} approveLabel={step?.actionLabel ?? "Approve"} />
                  </div>
                </div>

                <div className="mt-5 border-t border-slate-200/60 pt-4 dark:border-slate-700/60">
                  <WorkflowTimeline status={r.status} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className={strong ? "font-semibold text-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-300"}>
        {value}
      </p>
    </div>
  );
}
