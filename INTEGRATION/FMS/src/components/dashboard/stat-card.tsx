"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

type Accent = "brand" | "emerald" | "amber" | "violet" | "rose" | "slate";

const ACCENTS: Record<Accent, { ring: string; icon: string; glow: string }> = {
  brand: { ring: "text-brand-600 dark:text-brand-400", icon: "bg-brand-500/10 text-brand-600 dark:text-brand-300", glow: "from-brand-500/10" },
  emerald: { ring: "text-emerald-600 dark:text-emerald-400", icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300", glow: "from-emerald-500/10" },
  amber: { ring: "text-amber-600 dark:text-amber-400", icon: "bg-amber-500/10 text-amber-600 dark:text-amber-300", glow: "from-amber-500/10" },
  violet: { ring: "text-violet-600 dark:text-violet-400", icon: "bg-violet-500/10 text-violet-600 dark:text-violet-300", glow: "from-violet-500/10" },
  rose: { ring: "text-rose-600 dark:text-rose-400", icon: "bg-rose-500/10 text-rose-600 dark:text-rose-300", glow: "from-rose-500/10" },
  slate: { ring: "text-slate-600 dark:text-slate-300", icon: "bg-slate-500/10 text-slate-600 dark:text-slate-300", glow: "from-slate-500/10" },
};

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, duration]);
  return value;
}

export function StatCard({
  label,
  value,
  accent = "brand",
  icon,
  currency = true,
  delta,
  hint,
}: {
  label: string;
  value: number;
  accent?: Accent;
  icon?: React.ReactNode;
  currency?: boolean;
  delta?: number; // percentage change
  hint?: string;
}) {
  const animated = useCountUp(value);
  const a = ACCENTS[accent];
  const display = currency
    ? formatCurrency(animated)
    : Math.round(animated).toLocaleString("en-PH");

  return (
    <div className="glass-card relative overflow-hidden p-5">
      <div
        className={cn(
          "pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br to-transparent blur-2xl",
          a.glow,
        )}
      />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className={cn("stat-value mt-1 text-slate-800 dark:text-slate-100")}>
            {display}
          </p>
        </div>
        {icon && (
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", a.icon)}>
            {icon}
          </div>
        )}
      </div>
      {(delta !== undefined || hint) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {delta !== undefined && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium",
                delta >= 0
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-300",
              )}
            >
              {delta >= 0 ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
          {hint && <span className="text-slate-400">{hint}</span>}
        </div>
      )}
    </div>
  );
}
