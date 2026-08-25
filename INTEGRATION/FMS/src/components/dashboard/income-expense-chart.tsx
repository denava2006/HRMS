"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompactCurrency, formatCurrency } from "@/lib/utils";

// Palette validated for CVD + contrast in BOTH light and dark modes:
//   income  #3b82f6 (blue)   expense #c2740a (amber)
const INCOME = "#3b82f6";
const EXPENSE = "#c2740a";

export interface MonthPoint {
  month: string;
  income: number;
  expense: number;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 text-xs shadow-glass">
      <p className="mb-1.5 font-semibold text-slate-700 dark:text-slate-200">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: p.color }}
          />
          <span className="capitalize text-slate-500 dark:text-slate-400">{p.name}</span>
          <span className="ml-auto font-medium text-slate-700 dark:text-slate-200">
            {formatCurrency(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function IncomeExpenseChart({ data }: { data: MonthPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={2} barCategoryGap="24%" margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-200 dark:stroke-slate-800" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "currentColor" }}
            className="text-slate-400"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fontSize: 11, fill: "currentColor" }}
            className="text-slate-400"
            tickFormatter={(v) => formatCompactCurrency(v)}
          />
          <Tooltip
            cursor={{ fill: "currentColor", opacity: 0.05 }}
            content={<ChartTooltip />}
          />
          <Bar dataKey="income" name="Income" fill={INCOME} radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar dataKey="expense" name="Expenses" fill={EXPENSE} radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>

      {/* Legend — always present for >= 2 series; identity is never color-alone */}
      <div className="mt-2 flex items-center justify-center gap-5 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: INCOME }} />
          Income
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: EXPENSE }} />
          Expenses
        </span>
      </div>
    </div>
  );
}
