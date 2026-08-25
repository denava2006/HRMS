import { redirect } from "next/navigation";
import { Tags } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasAnyRole } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import type { Category } from "@/lib/types";

export default async function CategoriesPage() {
  const profile = await requireProfile();
  if (!hasAnyRole(profile.role, ["administrator", "finance_manager"])) redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").order("type").order("name");
  const cats = (data ?? []) as Category[];
  const income = cats.filter((c) => c.type === "income");
  const expense = cats.filter((c) => c.type === "expense");

  return (
    <div>
      <PageHeader title="Categories" description="Income and expense classifications used across the system." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Group title="Income Categories" items={income} accent="emerald" />
        <Group title="Expense Categories" items={expense} accent="amber" />
      </div>
    </div>
  );
}

function Group({
  title,
  items,
  accent,
}: {
  title: string;
  items: Category[];
  accent: "emerald" | "amber";
}) {
  const dot = accent === "emerald" ? "text-emerald-600 bg-emerald-500/10 dark:text-emerald-300" : "text-amber-600 bg-amber-500/10 dark:text-amber-300";
  return (
    <div className="glass-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${dot}`}>
          <Tags className="h-4 w-4" />
        </div>
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {items.length}
        </span>
      </div>
      <ul className="space-y-1.5">
        {items.map((c) => (
          <li key={c.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{c.name}</p>
              {c.description && <p className="text-xs text-slate-400">{c.description}</p>}
            </div>
            {!c.is_active && (
              <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] text-slate-400">Inactive</span>
            )}
          </li>
        ))}
        {items.length === 0 && <p className="py-6 text-center text-sm text-slate-400">None yet.</p>}
      </ul>
    </div>
  );
}
