import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isAdmin, roleName } from "@/lib/rbac";
import { initials } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { AddUserButton } from "@/components/user-dialog";
import { TableCard, Th, Td, Tr, EmptyRow } from "@/components/ui/table";
import type { Profile } from "@/lib/types";

export default async function UsersPage() {
  const profile = await requireProfile();
  if (!isAdmin(profile.role)) redirect("/dashboard");

  const supabase = await createClient();
  const [{ data }, { data: departmentRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*, department:departments!profiles_department_id_fkey(name)")
      .order("created_at", { ascending: true }),
    supabase.from("departments").select("id, name").order("name"),
  ]);
  const users = (data ?? []) as (Profile & { department?: { name: string } })[];
  const departments = (departmentRows ?? []) as { id: string; name: string }[];

  return (
    <div>
      <PageHeader
        title="User Management"
        description="Manage users, their roles and department assignments."
        action={<AddUserButton departments={departments} />}
      />
      <TableCard>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Employee No.</Th>
            <Th>Role</Th>
            <Th>Department</Th>
            <Th>Position</Th>
            <Th align="center">Status</Th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <Tr key={u.id}>
              <Td>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-emerald-600 text-xs font-semibold text-white">
                    {initials(u.full_name)}
                  </span>
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-200">{u.full_name}</p>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </div>
                </div>
              </Td>
              <Td className="font-mono text-xs text-slate-500">{u.employee_no ?? "—"}</Td>
              <Td>
                <span className="inline-flex rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:text-brand-300">
                  {roleName(u.role)}
                </span>
              </Td>
              <Td className="text-slate-500">{u.department?.name ?? "—"}</Td>
              <Td className="text-slate-500">{u.position ?? "—"}</Td>
              <Td align="center">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${u.is_active ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" : "bg-slate-500/10 text-slate-500"}`}>
                  {u.is_active ? "Active" : "Inactive"}
                </span>
              </Td>
            </Tr>
          ))}
          {users.length === 0 && <EmptyRow colSpan={6} label="No users found." />}
        </tbody>
      </TableCard>
    </div>
  );
}
