"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, ChevronDown, LogOut, User } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { initials } from "@/lib/utils";
import { roleName } from "@/lib/rbac";
import type { Profile } from "@/lib/types";

export function Topbar({
  profile,
  unread,
}: {
  profile: Profile;
  unread: number;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="glass-panel sticky top-0 z-20 flex h-16 items-center gap-3 rounded-none border-x-0 border-t-0 px-4 pl-16 lg:pl-6">
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />

        <Link
          href="/notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white/60 text-slate-600 transition hover:text-brand-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:text-brand-300"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>

        {/* User menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/60 py-1.5 pl-1.5 pr-2.5 text-left transition hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800/60"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-emerald-600 text-xs font-semibold text-white">
              {initials(profile.full_name)}
            </span>
            <span className="hidden sm:block">
              <span className="block text-xs font-semibold leading-tight text-slate-700 dark:text-slate-200">
                {profile.full_name}
              </span>
              <span className="block text-[10px] leading-tight text-slate-500 dark:text-slate-400">
                {roleName(profile.role)}
              </span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="glass-card absolute right-0 top-12 z-20 w-56 p-2">
                <div className="border-b border-slate-200/70 px-3 py-2 dark:border-slate-700/70">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {profile.full_name}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {profile.email}
                  </p>
                </div>
                <Link
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60"
                >
                  <User className="h-4 w-4" /> My Profile
                </Link>
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
