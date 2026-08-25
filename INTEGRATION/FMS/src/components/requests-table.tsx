import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TableCard, Th, Td, Tr, EmptyRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import type { RequestType, FinanceRequest } from "@/lib/types";

const PRIORITY: Record<string, string> = {
  high: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  low: "bg-slate-500/10 text-slate-500 dark:text-slate-400",
};

/** Server component: lists requests, optionally filtered to one type. */
export async function RequestsTable({ type }: { type?: RequestType }) {
  const supabase = await createClient();
  let query = supabase
    .from("requests")
    .select(
      "*, requester:profiles!requests_requester_id_fkey(full_name), department:departments(name), category:categories(name)",
    )
    .order("created_at", { ascending: false });
  if (type) query = query.eq("type", type);

  const { data } = await query;
  const rows = (data ?? []) as (FinanceRequest & {
    requester?: { full_name: string };
    department?: { name: string };
    category?: { name: string };
  })[];

  return (
    <TableCard>
      <thead>
        <tr>
          <Th>Reference</Th>
          <Th>Title</Th>
          <Th>Requester</Th>
          <Th>Category</Th>
          <Th align="right">Amount</Th>
          <Th align="center">Priority</Th>
          <Th align="center">Status</Th>
          <Th>Submitted</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <Tr key={r.id}>
            <Td className="font-mono text-xs">
              <Link href={`/requests/${r.id}`} className="text-brand-600 hover:underline dark:text-brand-400">
                {r.request_no}
              </Link>
            </Td>
            <Td className="max-w-[16rem] font-medium text-slate-700 dark:text-slate-200">
              <Link href={`/requests/${r.id}`} className="block truncate hover:underline">
                {r.title}
              </Link>
            </Td>
            <Td>{r.requester?.full_name ?? "—"}</Td>
            <Td className="text-slate-500">{r.category?.name ?? "—"}</Td>
            <Td align="right" className="font-medium text-slate-700 dark:text-slate-200">
              {formatCurrency(Number(r.amount))}
            </Td>
            <Td align="center">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY[r.priority] ?? PRIORITY.low}`}>
                {r.priority}
              </span>
            </Td>
            <Td align="center">
              <StatusBadge status={r.status} />
            </Td>
            <Td className="text-slate-500">{formatDate(r.created_at)}</Td>
          </Tr>
        ))}
        {rows.length === 0 && (
          <EmptyRow colSpan={8} label="No requests yet. Create your first request to get started." />
        )}
      </tbody>
    </TableCard>
  );
}
