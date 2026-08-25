import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { WORKFLOW_TIMELINE, timelineIndex } from "@/lib/workflow";
import type { RequestStatus } from "@/lib/types";

/**
 * Horizontal progress timeline of the approval chain. Highlights how far a
 * request has advanced — the visual backbone of the "each role depends on the
 * previous" workflow.
 */
export function WorkflowTimeline({
  status,
  className,
}: {
  status: RequestStatus;
  className?: string;
}) {
  const rejected = status === "rejected" || status === "returned" || status === "cancelled";
  const current = timelineIndex(status);

  return (
    <div className={cn("flex items-center", className)}>
      {WORKFLOW_TIMELINE.map((step, i) => {
        const done = !rejected && current > i;
        const active = !rejected && current === i;
        return (
          <div key={step.label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-semibold transition",
                  done && "border-emerald-500 bg-emerald-500 text-white",
                  active && "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-300",
                  !done && !active && "border-slate-300 text-slate-400 dark:border-slate-600",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={cn(
                  "hidden whitespace-nowrap text-[10px] font-medium sm:block",
                  active
                    ? "text-brand-600 dark:text-brand-300"
                    : done
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-slate-400",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < WORKFLOW_TIMELINE.length - 1 && (
              <div
                className={cn(
                  "mx-1 h-0.5 flex-1 rounded-full transition sm:mb-5",
                  done ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
