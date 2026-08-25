import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { TableCard, Th, Td, Tr, EmptyRow } from "@/components/ui/table";

interface PaymentRow {
  id: string;
  payment_no: string | null;
  amount: number;
  method: string;
  reference_number: string | null;
  status: string;
  paid_at: string | null;
  scheduled_date: string | null;
  request?: { request_no: string; title: string } | null;
  account?: { name: string } | null;
}

const METHOD_LABEL: Record<string, string> = {
  bank_transfer: "Bank Transfer",
  check: "Check",
  cash: "Cash",
  gcash: "GCash",
  credit_card: "Credit Card",
};

const STATUS: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  processing: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
  scheduled: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  failed: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
};

export default async function PaymentsPage() {
  await requireAccess("/payments");
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("*, request:requests(request_no, title), account:accounts(name)")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as PaymentRow[];
  const totalPaid = rows.filter((r) => r.status === "paid").reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Released payments, methods, references and proof of payment."
        action={
          <div className="glass-card px-4 py-2 text-right">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Total Released</p>
            <p className="text-lg font-semibold text-brand-600 dark:text-brand-400">{formatCurrency(totalPaid)}</p>
          </div>
        }
      />
      <TableCard>
        <thead>
          <tr>
            <Th>Payment No.</Th>
            <Th>For</Th>
            <Th>Method</Th>
            <Th>Reference</Th>
            <Th>Account</Th>
            <Th align="right">Amount</Th>
            <Th align="center">Status</Th>
            <Th>Paid</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Tr key={r.id}>
              <Td className="font-mono text-xs text-slate-500">{r.payment_no}</Td>
              <Td className="max-w-[14rem] font-medium text-slate-700 dark:text-slate-200">
                <span className="block truncate">{r.request?.title ?? "—"}</span>
                <span className="text-xs text-slate-400">{r.request?.request_no}</span>
              </Td>
              <Td className="text-slate-500">{METHOD_LABEL[r.method] ?? r.method}</Td>
              <Td className="font-mono text-xs text-slate-500">{r.reference_number ?? "—"}</Td>
              <Td className="text-slate-500">{r.account?.name ?? "—"}</Td>
              <Td align="right" className="font-medium text-slate-700 dark:text-slate-200">
                {formatCurrency(Number(r.amount))}
              </Td>
              <Td align="center">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS[r.status] ?? STATUS.scheduled}`}>
                  {r.status}
                </span>
              </Td>
              <Td className="text-slate-500">{formatDate(r.paid_at ?? r.scheduled_date)}</Td>
            </Tr>
          ))}
          {rows.length === 0 && <EmptyRow colSpan={8} label="No payments recorded yet." />}
        </tbody>
      </TableCard>
    </div>
  );
}
