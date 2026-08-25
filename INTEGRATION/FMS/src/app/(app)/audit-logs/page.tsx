import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasAnyRole } from "@/lib/rbac";
import { formatDate, timeAgo } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { TableCard, Th, Td, Tr, EmptyRow } from "@/components/ui/table";

interface LogRow {
  id: string;
  action: string;
  entity_type: string | null;
  description: string | null;
  created_at: string;
  actor?: { full_name: string; role: string } | null;
}

const ACTION_COLOR: Record<string, string> = {
  created: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
  submitted: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
  validated: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-300",
  final_approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  completed: "bg-teal-500/10 text-teal-600 dark:text-teal-300",
  rejected: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  returned: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  login: "bg-slate-500/10 text-slate-500 dark:text-slate-400",
};

export default async function AuditLogsPage() {
  const profile = await requireProfile();
  if (!hasAnyRole(profile.role, ["administrator", "finance_manager"])) redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_logs")
    .select("*, actor:profiles(full_name, role)")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as LogRow[];

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="A trail of every action for accountability — logins, approvals, payments and record changes."
      />
      <TableCard>
        <thead>
          <tr>
            <Th>Actor</Th>
            <Th align="center">Action</Th>
            <Th>Entity</Th>
            <Th>Description</Th>
            <Th>When</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <Tr key={l.id}>
              <Td className="font-medium text-slate-700 dark:text-slate-200">
                {l.actor?.full_name ?? "System"}
              </Td>
              <Td align="center">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${ACTION_COLOR[l.action] ?? "bg-slate-500/10 text-slate-500"}`}>
                  {l.action.replace(/_/g, " ")}
                </span>
              </Td>
              <Td className="text-slate-500">{l.entity_type ?? "—"}</Td>
              <Td className="max-w-[22rem] text-slate-500">
                <span className="block truncate">{l.description ?? "—"}</span>
              </Td>
              <Td className="text-slate-500" title={formatDate(l.created_at)}>{timeAgo(l.created_at)}</Td>
            </Tr>
          ))}
          {rows.length === 0 && <EmptyRow colSpan={5} label="No audit entries yet." />}
        </tbody>
      </TableCard>
    </div>
  );
}
