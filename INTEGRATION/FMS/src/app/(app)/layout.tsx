import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { navForRole } from "@/lib/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  const items = navForRole(profile.role);

  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .eq("is_read", false);

  return (
    <div className="app-backdrop min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar items={items} role={profile.role} />
      <div className="lg:pl-64">
        <Topbar profile={profile} unread={count ?? 0} />
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
