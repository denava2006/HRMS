import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Building2,
  CalendarDays,
  CalendarRange,
  FileText,
  FileSpreadsheet,
} from "lucide-react";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";

const REPORTS = [
  { key: "income", name: "Income Report", desc: "Income by category, account and period.", icon: TrendingUp, accent: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" },
  { key: "expense", name: "Expense Report", desc: "Expenses by category, department and vendor.", icon: TrendingDown, accent: "text-amber-600 dark:text-amber-400 bg-amber-500/10" },
  { key: "budget", name: "Budget Report", desc: "Allocation vs. utilization with alerts.", icon: Wallet, accent: "text-brand-600 dark:text-brand-400 bg-brand-500/10" },
  { key: "department", name: "Department Report", desc: "Spending and requests per department.", icon: Building2, accent: "text-violet-600 dark:text-violet-400 bg-violet-500/10" },
  { key: "monthly", name: "Monthly Report", desc: "Income, expenses and net for a month.", icon: CalendarDays, accent: "text-cyan-600 dark:text-cyan-400 bg-cyan-500/10" },
  { key: "yearly", name: "Yearly Report", desc: "Full-year financial summary.", icon: CalendarRange, accent: "text-rose-600 dark:text-rose-400 bg-rose-500/10" },
];

export default async function ReportsPage() {
  await requireAccess("/reports");
  const supabase = await createClient();
  const [{ data: income }, { data: expenses }] = await Promise.all([
    supabase.from("income").select("amount"),
    supabase.from("expenses").select("amount"),
  ]);
  const totalIncome = (income ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const totalExpense = (expenses ?? []).reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Generate and export financial reports (PDF / Excel)."
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Summary label="Total Income (YTD)" value={formatCurrency(totalIncome)} accent="text-emerald-600 dark:text-emerald-400" />
        <Summary label="Total Expenses (YTD)" value={formatCurrency(totalExpense)} accent="text-amber-600 dark:text-amber-400" />
        <Summary label="Net Profit (YTD)" value={formatCurrency(totalIncome - totalExpense)} accent="text-brand-600 dark:text-brand-400" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.key} className="glass-card flex flex-col p-5">
              <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${r.accent}`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">{r.name}</h3>
              <p className="mt-1 flex-1 text-sm text-slate-500 dark:text-slate-400">{r.desc}</p>
              <div className="mt-4 flex gap-2">
                <button className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white/60 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
                  <FileText className="h-3.5 w-3.5" /> PDF
                </button>
                <button className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white/60 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-emerald-300 hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-center text-xs text-slate-400">
        Export generation is a placeholder in this scaffold — wire it to a PDF/Excel service to enable downloads.
      </p>
    </div>
  );
}

function Summary({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="glass-card p-4">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
}
