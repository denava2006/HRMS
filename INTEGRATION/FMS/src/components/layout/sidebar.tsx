"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Wallet, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";
import { NAV_SECTIONS, type NavItem } from "@/lib/navigation";
import { roleName } from "@/lib/rbac";
import type { UserRole } from "@/lib/types";

export function Sidebar({
  items,
  role,
}: {
  items: NavItem[];
  role: UserRole;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const grouped = NAV_SECTIONS.map((section) => ({
    section,
    items: items.filter((i) => i.section === section),
  })).filter((g) => g.items.length > 0);

  const nav = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-emerald-600 text-white shadow-lg shadow-brand-600/25">
          <Wallet className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
            Fagle FMS
          </p>
          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
            {roleName(role)}
          </p>
        </div>
      </div>

      <div className="thin-scroll flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {grouped.map((group) => (
          <div key={group.section}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {group.section}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                        active
                          ? "bg-gradient-to-r from-brand-600/10 to-emerald-600/10 text-brand-700 dark:from-brand-500/15 dark:to-emerald-500/15 dark:text-brand-300"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100",
                      )}
                    >
                      <Icon
                        name={item.icon}
                        className={cn(
                          "h-4.5 w-4.5 shrink-0",
                          active
                            ? "text-brand-600 dark:text-brand-300"
                            : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200",
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile top trigger */}
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="fixed left-4 top-4 z-40 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white/80 text-slate-600 backdrop-blur lg:hidden dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Desktop sidebar */}
      <aside className="glass-panel fixed inset-y-0 left-0 z-30 hidden w-64 rounded-none border-y-0 border-l-0 lg:block">
        {nav}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="glass-card absolute inset-y-0 left-0 w-64 rounded-none">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
