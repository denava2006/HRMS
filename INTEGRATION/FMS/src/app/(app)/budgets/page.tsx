import { Wallet } from "lucide-react";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canAllocateBudget, canManageBudgets } from "@/lib/rbac";
import { budgetHealth, utilization, utilizationExact } from "@/lib/budget";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { AllocateButton, SetBudgetButton } from "@/components/budget-dialogs";

interface BudgetRow {
  id: string;
  name: string;
  period: string;
  fiscal_year: number;
  amount: number;
  spent: number;
  reserved: number;
  remaining: number;
  allocated: number;
  alert_threshold: number;
  department_name: string | null;
}

export default async function BudgetsPage() {
  const profile = await requireAccess("/budgets");
  const supabase = await createClient();

  // budget_status adds `reserved` (approved, awaiting payment) and `remaining`.
  const [{ data }, { data: departmentRows }] = await Promise.all([
    supabase.from("budget_status").select("*").order("amount", { ascending: false }),
    supabase.from("departments").select("id, name").order("name"),
  ]);
  const budgets = (data ?? []) as BudgetRow[];
  const departments = (departmentRows ?? []) as { id: string; name: string }[];

  // The Finance Manager owns the ceilings; Finance Staff draw from them.
  const canSet = canManageBudgets(profile.role);
  const canAllocate = canAllocateBudget(profile.role);

  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const totalSpent = budgets.reduce((s, b) => s + Number(b.spent), 0);
  const totalReserved = budgets.reduce((s, b) => s + Number(b.reserved), 0);

  return (
    <div>
      <PageHeader
        title="Budget Management"
        description={
          canSet
            ? "You set the ceilings for each department and period; Finance Staff allocate against them."
            : canAllocate
              ? "Allocate against the ceilings set by the Finance Manager and track utilization."
              : "Budgets are set by the Finance Manager. This view is read-only for your role."
        }
        action={canSet ? <SetBudgetButton departments={departments} /> : undefined}
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MiniStat label="Total Budget" value={formatCurrency(totalBudget)} />
        <MiniStat label="Spent" value={formatCurrency(totalSpent)} />
        <MiniStat label="Reserved" value={formatCurrency(totalReserved)} hint="Approved, awaiting payment" />
        <MiniStat label="Remaining" value={formatCurrency(totalBudget - totalSpent - totalReserved)} accent />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {budgets.map((b) => {
          const amount = Number(b.amount);
          const spent = Number(b.spent);
          const reserved = Number(b.reserved);
          const remaining = Number(b.remaining);
          const allocated = Number(b.allocated);
          const used = spent + reserved;
          // Two segments: money already paid out, then money committed by final
          // approval but not yet paid.
          const spentPct = utilization(spent, amount);
          const reservedPct = Math.min(100 - spentPct, utilization(reserved, amount));
          const health = budgetHealth(used, amount);
          const exactPct = utilizationExact(used, amount);
          return (
            <div key={b.id} className="glass-card p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">{b.name}</h3>
                  <p className="text-xs capitalize text-slate-500 dark:text-slate-400">
                    {b.department_name ?? "Company-wide"} · {b.period} · FY{b.fiscal_year}
                  </p>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
                  <Wallet className="h-4 w-4" />
                </div>
              </div>

              {/* Allocated / Spent / Remaining side by side — the three figures
                  that actually answer "can we still spend?" */}
              <dl className="mb-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/40">
                <Figure label="Allocated" value={formatCurrency(amount)} />
                <Figure label="Spent" value={formatCurrency(spent)} />
                <Figure
                  label="Remaining"
                  value={formatCurrency(remaining)}
                  tone={remaining < 0 ? "text-rose-600 dark:text-rose-300" : "text-emerald-600 dark:text-emerald-400"}
                />
              </dl>

              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">
                  {reserved > 0 ? (
                    <span className="text-amber-600 dark:text-amber-300">
                      {formatCurrency(reserved)} reserved
                    </span>
                  ) : (
                    "Utilization"
                  )}
                </span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {exactPct.toFixed(2)}%
                </span>
              </div>
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={
                    health.key === "healthy"
                      ? "h-full bg-gradient-to-r from-brand-500 to-emerald-500"
                      : health.key === "warning"
                        ? "h-full bg-amber-500"
                        : health.key === "full"
                          ? "h-full bg-orange-500"
                          : "h-full bg-rose-500"
                  }
                  style={{ width: `${spentPct}%` }}
                />
                {/* Reserved: committed at final approval, not yet paid. */}
                <div className="h-full bg-amber-400/50" style={{ width: `${reservedPct}%` }} />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${health.chip}`}>
                  <span aria-hidden>{health.dot}</span> {health.label}
                </span>
                <span className="text-xs text-slate-400">{health.note}</span>
              </div>

              {canAllocate && (
                <div className="mt-3 flex items-center justify-between border-t border-slate-200/60 pt-3 dark:border-slate-700/60">
                  <span className="text-xs text-slate-400">
                    {formatCurrency(allocated)} allocated
                  </span>
                  <AllocateButton
                    budgetId={b.id}
                    budgetName={b.name}
                    remaining={amount - allocated}
                  />
                </div>
              )}
            </div>
          );
        })}
        {budgets.length === 0 && (
          <p className="glass-card col-span-full py-12 text-center text-sm text-slate-400">
            No budgets defined yet.
            {canSet ? " Use “Set Budget” to create the first one." : " The Finance Manager sets these."}
          </p>
        )}
      </div>
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`text-sm font-semibold ${tone ?? "text-slate-800 dark:text-slate-100"}`}>
        {value}
      </dd>
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: string;
  accent?: boolean;
  hint?: string;
}) {
  return (
    <div className="glass-card p-4">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${accent ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-slate-100"}`}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}
