"use client";

import { useActionState, useEffect, useState } from "react";
import { RefreshCw, UserPlus } from "lucide-react";
import { createUser } from "@/lib/actions";
import { ALL_ROLES, ROLES } from "@/lib/rbac";
import { Modal } from "@/components/ui/modal";
import { FormError, SubmitButton, fieldClass, labelClass } from "@/components/ui/form";
import type { FormState } from "@/lib/types";

interface Option {
  id: string;
  name: string;
}

/** Readable temporary password the Administrator can hand over verbally. */
function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint32Array(10);
  crypto.getRandomValues(bytes);
  return (
    Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("") + "!1"
  );
}

export function AddUserButton({ departments }: { departments: Option[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:opacity-95"
      >
        <UserPlus className="h-4 w-4" /> Add User
      </button>

      {open && (
        <Modal
          wide
          title="Add User"
          description="Creates the sign-in account and its profile in one step."
          onClose={() => setOpen(false)}
        >
          {/* Mounted only while open, so a previous submission's state never
              leaks into the next one. */}
          <AddUserForm departments={departments} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

function AddUserForm({
  departments,
  onDone,
}: {
  departments: Option[];
  onDone: () => void;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(createUser, {});
  const [password, setPassword] = useState("");

  useEffect(() => setPassword(generatePassword()), []);
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={state.error} />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="full_name">Full Name *</label>
          <input id="full_name" name="full_name" required placeholder="e.g. Maria Santos" className={fieldClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="email">Email *</label>
          <input id="email" name="email" type="email" required placeholder="name@fagle.ph" className={fieldClass} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="role">Role *</label>
          <select id="role" name="role" defaultValue="employee" className={fieldClass}>
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>{ROLES[r].name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="employee_no">Employee No.</label>
          <input id="employee_no" name="employee_no" placeholder="e.g. EMP-0009" className={fieldClass} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="department_id">Department</label>
          <select id="department_id" name="department_id" defaultValue="" className={fieldClass}>
            <option value="">— None —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="position">Position</label>
          <input id="position" name="position" placeholder="e.g. Operations Associate" className={fieldClass} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="phone">Phone</label>
          <input id="phone" name="phone" placeholder="e.g. +63 917 000 0000" className={fieldClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="password">Temporary Password *</label>
          <div className="flex gap-2">
            <input
              id="password"
              name="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${fieldClass} font-mono`}
            />
            <button
              type="button"
              onClick={() => setPassword(generatePassword())}
              title="Generate a new password"
              className="shrink-0 rounded-xl border border-slate-200 px-3 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-slate-200/70 pt-4 dark:border-slate-700/70">
        <p className="text-xs text-slate-400">
          Share the temporary password with the user — they can change it from their profile.
        </p>
        <SubmitButton label="Create User" icon={UserPlus} />
      </div>
    </form>
  );
}
