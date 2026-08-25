import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  ClipboardList,
  ArrowRight,
  Clock,
} from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isReviewer } from "@/lib/rbac";
import { budgetHealth, utilization } from "@/lib/budget";
import { canActOn } from "@/lib/workflow";
import { formatCurrency, formatDate, timeAgo } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  IncomeExpenseChart,
  type MonthPoint,
} from "@/components/dashboard/income-expense-chart";
import { WorkflowTimeline } from "@/components/workflow-timeline";
import { StatusBadge } from "@/components/ui/status-badge";
import type { FinanceRequest } from "@/lib/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function buildMonthly(
  income: { amount: number; received_date: string }[],
  expenses: { amount: number; expense_date: string }[],
): MonthPoint[] {
  const points: MonthPoint[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const inc = income
      .filter((r) => {
        const rd = new Date(r.received_date);
        return `${rd.getFullYear()}-${rd.getMonth()}` === key;
      })
      .reduce((s, r) => s + Number(r.amount), 0);
    const exp = expenses
      .filter((r) => {
        const rd = new Date(r.expense_date);
        return `${rd.getFullYear()}-${rd.getMonth()}` === key;
      })
      .reduce((s, r) => s + Number(r.amount), 0);
    points.push({ month: MONTHS[d.getMonth()], income: inc, expense: exp });
  }
  return points;
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const reviewer = isReviewer(profile.role);

  // Requests visible to this user (RLS scopes employees to their own).
  const { data: requestsRaw } = await supabase
    .from("requests")
    .select("*, requester:profiles!requests_requester_id_fkey(full_name), department:departments(name)")
    .order("created_at", { ascending: false });
  const requests = (requestsRaw ?? []) as (FinanceRequest & {
    requester?: { full_name: string };
    department?: { name: string };
  })[];

  // Financials — RLS returns empty for plain employees, so we guard by role.
  const [incomeRes, expenseRes, budgetRes] = reviewer
    ? await Promise.all([
        supabase.from("income").select("amount, received_date"),
        supabase.from("expenses").select("amount, expense_date"),
        // budget_status carries `reserved` and `remaining`, so the dashboard
        // and the Budgets page always agree on what is left.
        supabase.from("budget_status").select("*").order("amount", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const income = (incomeRes.data ?? []) as { amount: number; received_date: string }[];
  const expenses = (expenseRes.data ?? []) as { amount: number; expense_date: string }[];
  const budgets = (budgetRes.data ?? []) as {
    id: string;
    name: string;
    amount: number;
    spent: number;
    reserved: number;
    remaining: number;
    period: string;
    alert_threshold: number;
    department_name: string | null;
  }[];

  const totalIncome = income.reduce((s, r) => s + Number(r.amount), 0);
  const totalExpense = expenses.reduce((s, r) => s + Number(r.amount), 0);
  const netProfit = totalIncome - totalExpense;

  const monthlyBudgets = budgets.filter((b) => b.period === "monthly");
  const monthlyBudgetTotal = monthlyBudgets.reduce((s, b) => s + Number(b.amount), 0);
  const remainingBudget = monthlyBudgets.reduce((s, b) => s + Number(b.remaining), 0);

  const monthly = buildMonthly(income, expenses);

  const pending = requests.filter((r) => canActOn(r.status, profile.role));
  const myOpen = requests.filter(
    (r) => r.requester_id === profile.id && !["completed", "rejected", "cancelled"].includes(r.status),
  );

  // Recent workflow activity
  const { data: activityRaw } = await supabase
    .from("request_approvals")
    .select("*, actor:profiles(full_name), request:requests(request_no, title)")
    .order("created_at", { ascending: false })
    .limit(6);
  const activity = (activityRaw ?? []) as {
    id: string;
    action: string;
    remarks: string | null;
    created_at: string;
    actor?: { full_name: string };
    request?: { request_no: string; title: string };
  }[];

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${profile.full_name.split(" ")[0]}`}
        description={
          reviewer
            ? "Here's the financial pulse of Fagle Financial Services."
            : "Track your requests and submit new ones."
        }
        action={
          <Link
            href="/purchase-requests"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:opacity-95"
          >
            <ClipboardList className="h-4 w-4" /> New Request
          </Link>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {reviewer ? (
          <>
            <StatCard label="Total Income (YTD)" value={totalIncome} accent="brand" icon={<TrendingUp className="h-5 w-5" />} hint="all recorded income" />
            <StatCard label="Total Expenses (YTD)" value={totalExpense} accent="amber" icon={<TrendingDown className="h-5 w-5" />} hint="all recorded expenses" />
            <StatCard label="Net Profit" value={netProfit} accent={netProfit >= 0 ? "emerald" : "rose"} icon={<PiggyBank className="h-5 w-5" />} hint="income − expenses" />
            <StatCard label="Remaining Budget" value={remainingBudget} accent="violet" icon={<Wallet className="h-5 w-5" />} hint={`of ${formatCurrency(monthlyBudgetTotal)} monthly`} />
          </>
        ) : (
          <>
            <StatCard label="My Open Requests" value={myOpen.length} accent="brand" currency={false} icon={<ClipboardList className="h-5 w-5" />} hint="in progress" />
            <StatCard label="Total Requests" value={requests.length} accent="violet" currency={false} icon={<ClipboardList className="h-5 w-5" />} hint="all time" />
            <StatCard label="Completed" value={requests.filter((r) => r.status === "completed").length} accent="emerald" currency={false} icon={<TrendingUp className="h-5 w-5" />} hint="paid & recorded" />
            <StatCard label="Needs Attention" value={requests.filter((r) => r.status === "returned").length} accent="amber" currency={false} icon={<Clock className="h-5 w-5" />} hint="returned to you" />
          </>
        )}
      </div>

      {/* Chart + pending approvals */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {reviewer ? (
          <div className="glass-card p-5 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Income vs Expenses
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Last 7 months
                </p>
              </div>
            </div>
            <IncomeExpenseChart data={monthly} />
          </div>
        ) : (
          <div className="glass-card p-5 lg:col-span-2">
            <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
              How your request moves
            </h3>
            <WorkflowTimeline status="pending_finance_staff" className="px-2" />
            <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
              Every request flows through five stages. Each approver hands it to
              the next — from Finance Staff who checks it against your
              department&apos;s budget, to the Finance Manager who approves it, to
              the Accountant who pays and records it.
            </p>
          </div>
        )}

        {/* Pending approvals / my requests */}
        <div className="glass-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {reviewer ? "Pending Your Action" : "My Recent Requests"}
            </h3>
            <Link href={reviewer ? "/approvals" : "/purchase-requests"} className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {(reviewer ? pending : myOpen).slice(0, 5).map((r) => (
              <Link
                key={r.id}
                href={`/requests/${r.id}`}
                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white/40 p-2.5 transition hover:border-brand-200 dark:border-slate-800 dark:bg-slate-800/30"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                    {r.title}
                  </p>
                  <p className="text-xs text-slate-400">
                    {r.request_no} · {formatCurrency(Number(r.amount))}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </Link>
            ))}
            {(reviewer ? pending : myOpen).length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">
                Nothing needs your attention. 🎉
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Budget utilization + activity */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {reviewer && (
          <div className="glass-card p-5 lg:col-span-2">
            <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Budget Utilization
            </h3>
            <div className="space-y-4">
              {budgets.slice(0, 5).map((b) => {
                // Committed money is spent + reserved, matching the Budgets page.
                const used = Number(b.spent) + Number(b.reserved);
                const pct = utilization(used, Number(b.amount));
                const health = budgetHealth(used, Number(b.amount));
                return (
                  <div key={b.id}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-600 dark:text-slate-300">
                        {b.name}
                        {b.department_name ? ` · ${b.department_name}` : ""}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {formatCurrency(used)} / {formatCurrency(Number(b.amount))}
                        {health.key !== "healthy" && (
                          <span className={`ml-2 rounded px-1.5 py-0.5 font-medium ${health.chip}`}>
                            {health.dot} {health.label}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={
                          health.key === "healthy"
                            ? "h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500"
                            : health.key === "warning"
                              ? "h-full rounded-full bg-amber-500"
                              : health.key === "full"
                                ? "h-full rounded-full bg-orange-500"
                                : "h-full rounded-full bg-rose-500"
                        }
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {budgets.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-400">No budgets defined yet.</p>
              )}
            </div>
          </div>
        )}

        <div className={reviewer ? "glass-card p-5" : "glass-card p-5 lg:col-span-3"}>
          <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Recent Activity
          </h3>
          <ol className="space-y-3">
            {activity.map((a) => (
              <li key={a.id} className="flex gap-3">
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gradient-to-br from-brand-500 to-emerald-500" />
                <div className="min-w-0">
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {a.actor?.full_name ?? "Someone"}
                    </span>{" "}
                    {a.action.replace(/_/g, " ")}{" "}
                    <span className="text-slate-500">
                      {a.request?.request_no ?? ""}
                    </span>
                  </p>
                  <p className="text-xs text-slate-400">{timeAgo(a.created_at)}</p>
                </div>
              </li>
            ))}
            {activity.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-400">No activity yet.</p>
            )}
          </ol>
        </div>
      </div>
    </div>
  );
}
