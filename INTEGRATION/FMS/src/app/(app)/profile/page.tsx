import { Mail, Phone, Building2, BadgeCheck, LogOut } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { ROLES, roleName } from "@/lib/rbac";
import { initials } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";

export default async function ProfilePage() {
  const profile = await requireProfile();
  const meta = ROLES[profile.role];

  return (
    <div>
      <PageHeader title="My Profile" description="Your account and role information." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="glass-card flex flex-col items-center p-6 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-emerald-600 text-2xl font-bold text-white">
            {initials(profile.full_name)}
          </span>
          <h2 className="mt-3 text-lg font-bold text-slate-800 dark:text-slate-100">{profile.full_name}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{profile.position ?? roleName(profile.role)}</p>
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-700 dark:text-brand-300">
            <BadgeCheck className="h-3.5 w-3.5" /> {roleName(profile.role)}
          </span>
          <form action="/auth/signout" method="post" className="mt-5 w-full">
            <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </form>
        </div>

        <div className="glass-card p-6 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Account Details</h3>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field icon={<Mail className="h-4 w-4" />} label="Email" value={profile.email} />
            <Field icon={<Phone className="h-4 w-4" />} label="Phone" value={profile.phone ?? "—"} />
            <Field icon={<Building2 className="h-4 w-4" />} label="Department" value={profile.department?.name ?? "—"} />
            <Field icon={<BadgeCheck className="h-4 w-4" />} label="Employee No." value={profile.employee_no ?? "—"} />
          </dl>

          <div className="mt-6 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/40">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              What you can do
            </p>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{meta.description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        {icon}
      </div>
      <div>
        <dt className="text-xs text-slate-400">{label}</dt>
        <dd className="text-sm font-medium text-slate-700 dark:text-slate-200">{value}</dd>
      </div>
    </div>
  );
}
