import type { BudgetPeriod } from "./types";

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const QUARTER_NAMES = [
  "Q1 (Jan–Mar)", "Q2 (Apr–Jun)", "Q3 (Jul–Sep)", "Q4 (Oct–Dec)",
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * The calendar window a budget covers. `index` is the month (1-12) for monthly
 * budgets and the quarter (1-4) for quarterly ones; it is ignored for yearly.
 * Dates are built in UTC so the ISO string is never shifted by a timezone.
 */
export function periodRange(
  period: BudgetPeriod,
  year: number,
  index: number,
): { start: string; end: string } {
  if (period === "monthly") {
    const m = Math.min(12, Math.max(1, index));
    return {
      start: iso(new Date(Date.UTC(year, m - 1, 1))),
      end: iso(new Date(Date.UTC(year, m, 0))),
    };
  }
  if (period === "quarterly") {
    const q = Math.min(4, Math.max(1, index));
    const firstMonth = (q - 1) * 3;
    return {
      start: iso(new Date(Date.UTC(year, firstMonth, 1))),
      end: iso(new Date(Date.UTC(year, firstMonth + 3, 0))),
    };
  }
  return {
    start: iso(new Date(Date.UTC(year, 0, 1))),
    end: iso(new Date(Date.UTC(year, 11, 31))),
  };
}

/** Percentage of a budget consumed, clamped to 0-100 for progress bars. */
export function utilization(spent: number, amount: number): number {
  if (!amount || amount <= 0) return 0;
  return Math.min(100, Math.round((spent / amount) * 100));
}

/** True utilization — may exceed 100%, which is what makes it worth showing. */
export function utilizationExact(used: number, amount: number): number {
  if (!amount || amount <= 0) return 0;
  return Math.round((used / amount) * 10000) / 100;
}

export type BudgetHealth = "healthy" | "warning" | "full" | "exceeded";

export interface BudgetHealthMeta {
  key: BudgetHealth;
  label: string;
  dot: string;
  note: string;
  chip: string;
}

export const BUDGET_HEALTH: Record<BudgetHealth, BudgetHealthMeta> = {
  healthy: {
    key: "healthy",
    label: "Healthy",
    dot: "🟢",
    note: "Budget is within a comfortable range.",
    chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  warning: {
    key: "warning",
    label: "Warning",
    dot: "🟡",
    note: "Budget utilization exceeds 80%.",
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  full: {
    key: "full",
    label: "Budget Fully Utilized",
    dot: "🟠",
    note: "No further approvals.",
    chip: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  },
  exceeded: {
    key: "exceeded",
    label: "Budget Exceeded",
    dot: "🔴",
    note: "Approval blocked.",
    chip: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
};

/**
 * Health of a budget from how much of it is committed (spent + reserved):
 *   under 80% healthy · above 80% warning · exactly 100% full · beyond exceeded
 *
 * Compared on the raw amounts rather than the displayed percentage: rounding to
 * two decimals would report ₱299,999 of ₱300,000 as "fully utilized" and, worse,
 * ₱300,001 of ₱300,000 as well — hiding a budget that is actually over.
 */
export function budgetHealth(used: number, amount: number): BudgetHealthMeta {
  if (!amount || amount <= 0) {
    return used > 0 ? BUDGET_HEALTH.exceeded : BUDGET_HEALTH.healthy;
  }
  if (used > amount) return BUDGET_HEALTH.exceeded;
  if (used === amount) return BUDGET_HEALTH.full;
  if (used > amount * 0.8) return BUDGET_HEALTH.warning;
  return BUDGET_HEALTH.healthy;
}

/** Label for the period picker, e.g. "July" or "Q3 (Jul–Sep)". */
export function periodOptions(period: BudgetPeriod): string[] {
  if (period === "monthly") return MONTH_NAMES;
  if (period === "quarterly") return QUARTER_NAMES;
  return [];
}
