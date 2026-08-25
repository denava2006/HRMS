import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canRecordIncome } from "@/lib/rbac";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { RecordIncomeButton } from "@/components/income-dialog";
import { TableCard, Th, Td, Tr, EmptyRow } from "@/components/ui/table";

interface IncomeRow {
  id: string;
  reference_no: string | null;
  source: string;
  amount: number;
  received_date: string;
  category?: { name: string } | null;
  account?: { name: string } | null;
  department?: { name: string } | null;
}

export default async function IncomePage() {
  const profile = await requireAccess("/income");
  const supabase = await createClient();

  const [{ data }, { data: categories }, { data: accounts }, { data: departments }] =
    await Promise.all([
      supabase
        .from("income")
        .select("*, category:categories(name), account:accounts(name), department:departments(name)")
        .order("received_date", { ascending: false }),
      supabase.from("categories").select("id, name").eq("type", "income").eq("is_active", true).order("name"),
      supabase.from("accounts").select("id, name").eq("is_active", true).order("name"),
      supabase.from("departments").select("id, name").order("name"),
    ]);

  const rows = (data ?? []) as IncomeRow[];
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  const canRecord = canRecordIncome(profile.role);

  return (
    <div>
      <PageHeader
        title="Income Management"
        description="Recorded income across categories and accounts."
        action={
          <div className="flex items-center gap-3">
            <div className="glass-card px-4 py-2 text-right">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Total Income</p>
              <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(total)}</p>
            </div>
            {canRecord && (
              <RecordIncomeButton
                categories={categories ?? []}
                accounts={accounts ?? []}
                departments={departments ?? []}
              />
            )}
          </div>
        }
      />
      <TableCard>
        <thead>
          <tr>
            <Th>Reference</Th>
            <Th>Source</Th>
            <Th>Category</Th>
            <Th>Account</Th>
            <Th>Department</Th>
            <Th align="right">Amount</Th>
            <Th>Date</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Tr key={r.id}>
              <Td className="font-mono text-xs text-slate-500">{r.reference_no}</Td>
              <Td className="font-medium text-slate-700 dark:text-slate-200">{r.source}</Td>
              <Td className="text-slate-500">{r.category?.name ?? "—"}</Td>
              <Td className="text-slate-500">{r.account?.name ?? "—"}</Td>
              <Td className="text-slate-500">{r.department?.name ?? "—"}</Td>
              <Td align="right" className="font-medium text-emerald-600 dark:text-emerald-400">
                {formatCurrency(Number(r.amount))}
              </Td>
              <Td className="text-slate-500">{formatDate(r.received_date)}</Td>
            </Tr>
          ))}
          {rows.length === 0 && <EmptyRow colSpan={7} label="No income recorded yet." />}
        </tbody>
      </TableCard>
    </div>
  );
}
