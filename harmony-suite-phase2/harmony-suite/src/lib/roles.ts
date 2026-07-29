import type { UserRole } from '@/lib/database.types'

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrator',
  hr_manager: 'HR Manager',
  hr_staff: 'HR Staff',
  employee: 'Employee',
}

/** Roles an Administrator can create from HR Accounts. Administrators are
 * deliberately not creatable from the UI (see create-hr-account). */
export const CREATABLE_HR_ROLES = ['hr_staff', 'hr_manager'] as const
export type CreatableHrRole = (typeof CREATABLE_HR_ROLES)[number]

export const DEFAULT_ROLE_PASSWORD: Record<CreatableHrRole, string> = {
  hr_staff: 'HrStaff123',
  hr_manager: 'HrManager123',
}

/** Approving payroll for release and deciding leave requests are the HR
 * Manager's calls, not HR Staff's. Mirrors the database's
 * is_hr_manager_or_admin() — the triggers are the real enforcement, this just
 * keeps the UI from offering an action that would always be rejected. */
export function canApproveWork(role: UserRole | undefined): boolean {
  return role === 'admin' || role === 'hr_manager'
}
