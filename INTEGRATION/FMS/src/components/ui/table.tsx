import { cn } from "@/lib/utils";

export function TableCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass-card overflow-hidden p-0">
      <div className="thin-scroll overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  );
}

export function Th({
  children,
  className,
  align = "left",
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      className={cn(
        "whitespace-nowrap border-b border-slate-200/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700/70 dark:text-slate-400",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  align = "left",
  title,
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  title?: string;
}) {
  return (
    <td
      title={title}
      className={cn(
        "whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function Tr({ children }: { children: React.ReactNode }) {
  return (
    <tr className="border-b border-slate-100 transition last:border-0 hover:bg-slate-50/60 dark:border-slate-800/70 dark:hover:bg-slate-800/30">
      {children}
    </tr>
  );
}

export function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-slate-400">
        {label}
      </td>
    </tr>
  );
}
