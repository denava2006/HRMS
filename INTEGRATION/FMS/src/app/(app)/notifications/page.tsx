import Link from "next/link";
import { Bell, Check, CheckCheck } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions";
import type { Notification } from "@/lib/types";

const DOT: Record<string, string> = {
  approval: "bg-blue-500",
  payment: "bg-emerald-500",
  rejection: "bg-rose-500",
  system: "bg-violet-500",
  info: "bg-slate-400",
};

export default async function NotificationsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Notification[];
  const unread = rows.filter((n) => !n.is_read).length;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={unread > 0 ? `You have ${unread} unread notification${unread > 1 ? "s" : ""}.` : "You're all caught up."}
        action={
          unread > 0 ? (
            <form action={markAllNotificationsRead}>
              <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/60 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:text-brand-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                <CheckCheck className="h-4 w-4" /> Mark all read
              </button>
            </form>
          ) : undefined
        }
      />

      <div className="space-y-2">
        {rows.map((n) => (
          <div
            key={n.id}
            className={`glass-card flex items-start gap-3 p-4 ${n.is_read ? "opacity-70" : ""}`}
          >
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[n.type] ?? DOT.info}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{n.title}</p>
                {!n.is_read && (
                  <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-medium text-brand-600 dark:text-brand-300">
                    New
                  </span>
                )}
              </div>
              {n.body && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{n.body}</p>}
              <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-400">
                <span>{timeAgo(n.created_at)}</span>
                {n.link && (
                  <Link href={n.link} className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                    Open
                  </Link>
                )}
              </div>
            </div>
            {!n.is_read && (
              <form action={markNotificationRead}>
                <input type="hidden" name="id" value={n.id} />
                <button
                  aria-label="Mark as read"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-emerald-600 dark:hover:bg-slate-800"
                >
                  <Check className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>
        ))}
        {rows.length === 0 && (
          <div className="glass-card flex flex-col items-center py-16 text-center">
            <Bell className="mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-400">No notifications yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
