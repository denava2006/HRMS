import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export type DateRange = { start: Date; end: Date; label: string };

export function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
export function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }

export function todayRange(): DateRange {
  const now = new Date();
  return { start: startOfDay(now), end: endOfDay(now), label: "Today" };
}
export function yesterdayRange(): DateRange {
  const y = new Date(); y.setDate(y.getDate() - 1);
  return { start: startOfDay(y), end: endOfDay(y), label: "Yesterday" };
}
export function weekRange(): DateRange {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const diff = (day + 6) % 7; // Monday as start
  const start = new Date(now); start.setDate(now.getDate() - diff);
  return { start: startOfDay(start), end: endOfDay(now), label: "This Week" };
}
export function monthRange(): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: startOfDay(start), end: endOfDay(now), label: "This Month" };
}
export function yearRange(): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return { start: startOfDay(start), end: endOfDay(now), label: "This Year" };
}

type Preset = "today" | "yesterday" | "week" | "month" | "year" | "custom";

export function DateFilter({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const [preset, setPreset] = useState<Preset>("today");
  const [customDate, setCustomDate] = useState<Date | undefined>();

  const select = (p: Preset, d?: Date) => {
    setPreset(p);
    if (p === "today") onChange(todayRange());
    else if (p === "yesterday") onChange(yesterdayRange());
    else if (p === "week") onChange(weekRange());
    else if (p === "month") onChange(monthRange());
    else if (p === "year") onChange(yearRange());
    else if (p === "custom" && d) {
      setCustomDate(d);
      onChange({ start: startOfDay(d), end: endOfDay(d), label: format(d, "MMM d, yyyy") });
    }
  };

  const btn = (active: boolean) =>
    cn("h-9 px-3.5 rounded-full text-sm font-medium transition-base whitespace-nowrap",
      active ? "bg-gradient-primary text-primary-foreground shadow-pop" : "bg-secondary text-secondary-foreground hover:bg-secondary/80");

  return (
    <div className="flex flex-wrap gap-2">
      <button className={btn(preset === "today")} onClick={() => select("today")}>Today</button>
      <button className={btn(preset === "yesterday")} onClick={() => select("yesterday")}>Yesterday</button>
      <button className={btn(preset === "week")} onClick={() => select("week")}>Week</button>
      <button className={btn(preset === "month")} onClick={() => select("month")}>Month</button>
      <button className={btn(preset === "year")} onClick={() => select("year")}>Year</button>
      <Popover>
        <PopoverTrigger asChild>
          <button className={btn(preset === "custom")}>
            <CalendarIcon className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            {preset === "custom" && customDate ? format(customDate, "MMM d") : "Custom"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={customDate}
            onSelect={(d) => d && select("custom", d)}
            disabled={(d) => d > new Date()}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
