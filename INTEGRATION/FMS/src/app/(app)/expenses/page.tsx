import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { TableCard, Th, Td, Tr, EmptyRow } from "@/components/ui/table";

interface ExpenseRow {
  id: string;
  reference_no: string | null;
  description: string;
  amount: number;
  expense_date: string;
  payment_status: string;
  category?: { name: string } | null;
  department?: { name: string } | null;
  vendor?: { name: string } | null;
}

const PAY_STATUS: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  scheduled: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  unpaid: "bg-slate-500/10 text-slate-500 dark:text-slate-400",
};

export default async function ExpensesPage() {
  await requireAccess("/expenses");
  const supabase = await createClient();
  const { data } = await supabase
    .from("expenses")
    .select("*, category:categories(name), department:departments(name), vendor:vendors(name)")
    .order("expense_date", { ascending: false });
  const rows = (data ?? []) as ExpenseRow[];
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div>
      <PageHeader
        title="Expense Management"
        description="Recorded expenses by category, department and vendor."
        action={
          <div className="glass-card px-4 py-2 text-right">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Total Expenses</p>
            <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(total)}</p>
          </div>
        }
      />
      <TableCard>
        <thead>
          <tr>
            <Th>Reference</Th>
            <Th>Description</Th>
            <Th>Category</Th>
            <Th>Department</Th>
            <Th>Vendor</Th>
            <Th align="right">Amount</Th>
            <Th align="center">Status</Th>
            <Th>Date</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Tr key={r.id}>
              <Td className="font-mono text-xs text-slate-500">{r.reference_no}</Td>
              <Td className="max-w-[16rem] font-medium text-slate-700 dark:text-slate-200">
                <span className="block truncate">{r.description}</span>
              </Td>
              <Td className="text-slate-500">{r.category?.name ?? "—"}</Td>
              <Td className="text-slate-500">{r.department?.name ?? "—"}</Td>
              <Td className="text-slate-500">{r.vendor?.name ?? "—"}</Td>
              <Td align="right" className="font-medium text-slate-700 dark:text-slate-200">
                {formatCurrency(Number(r.amount))}
              </Td>
              <Td align="center">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PAY_STATUS[r.payment_status] ?? PAY_STATUS.unpaid}`}>
                  {r.payment_status}
                </span>
              </Td>
              <Td className="text-slate-500">{formatDate(r.expense_date)}</Td>
            </Tr>
          ))}
          {rows.length === 0 && <EmptyRow colSpan={8} label="No expenses recorded yet." />}
        </tbody>
      </TableCard>
    </div>
  );
}
