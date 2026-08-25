import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";

interface DeptRow {
  id: string;
  name: string;
  code: string;
  description: string | null;
  manager?: { full_name: string } | null;
  members?: { count: number }[];
}

export default async function DepartmentsPage() {
  const profile = await requireProfile();
  if (!isAdmin(profile.role)) redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase
    .from("departments")
    .select("*, manager:profiles!departments_manager_fk(full_name), members:profiles!profiles_department_id_fkey(count)")
    .order("name");
  const rows = (data ?? []) as DeptRow[];

  return (
    <div>
      <PageHeader title="Departments" description="Organizational units and their managers." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((d) => (
          <div key={d.id} className="glass-card p-5">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">{d.name}</h3>
                <p className="font-mono text-xs text-slate-400">{d.code}</p>
              </div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{d.description ?? "—"}</p>
            <div className="mt-3 flex items-center justify-between border-t border-slate-200/60 pt-3 text-xs dark:border-slate-700/60">
              <span className="text-slate-400">
                Manager:{" "}
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  {d.manager?.full_name ?? "Unassigned"}
                </span>
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {d.members?.[0]?.count ?? 0} members
              </span>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="glass-card col-span-full py-12 text-center text-sm text-slate-400">No departments found.</p>
        )}
      </div>
    </div>
  );
}
