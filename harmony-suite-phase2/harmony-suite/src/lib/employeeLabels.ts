import type { EmploymentStatus } from '@/lib/database.types'
import type { BadgeProps } from '@/components/ui/badge'

export const EMPLOYMENT_STATUS_LABEL: Record<EmploymentStatus, string> = {
  active: 'Active',
  on_leave: 'On Leave',
  resigned: 'Resigned',
  terminated: 'Terminated',
  retired: 'Retired',
}

export const EMPLOYMENT_STATUS_VARIANT: Record<EmploymentStatus, BadgeProps['variant']> = {
  active: 'success',
  on_leave: 'warning',
  resigned: 'muted',
  terminated: 'destructive',
  retired: 'muted',
}

/** The statuses HR may set by hand. 'on_leave' is deliberately absent: it's
 * derived from whether an approved leave request covers today, and clears
 * itself when the leave ends (see sync_employment_statuses()). Letting someone
 * pick it manually would create a state the system then silently overwrites. */
export const SELECTABLE_EMPLOYMENT_STATUSES: EmploymentStatus[] = ['active', 'resigned', 'terminated', 'retired']

/** Not a stored employment_status value — a deployed applicant with no employees
 * row yet renders with this client-side-only pseudo-status. See usePendingEmployees. */
export const PENDING_EMPLOYEE_STATUS = 'pending_creation'
export const PENDING_EMPLOYEE_STATUS_LABEL = 'Pending Employee Creation'

export const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Widowed', 'Separated', 'Divorced'] as const

/** Resume is deliberately absent — it's collected once on the public
 * application form and carried through, so re-uploading it here would just
 * create a second, divergent copy. These are the supporting documents HR
 * collects on top of it. */
export const DOCUMENT_TYPE_OPTIONS = [
  'Government ID',
  'Birth Certificate',
  'Medical Certificate',
  'NBI Clearance',
  'Diploma',
  'Transcript',
  'Certificate',
  'Employment Contract',
  'Other',
] as const

export const EMPLOYEE_HISTORY_EVENT_LABEL: Record<string, string> = {
  record_created: 'Employee Record Created',
  employee_id_generated: 'Employee ID Generated',
  account_created: 'Employee Account Created',
  invitation_sent: 'Invitation Email Sent',
  invitation_resent: 'Invitation Email Resent',
  account_activated: 'Employee Activated Account',
  account_enabled: 'Employee Account Enabled',
  account_disabled: 'Employee Account Disabled',
  documents_uploaded: 'Documents Uploaded',
  department_assigned: 'Department Assigned',
  position_assigned: 'Position Assigned',
  status_updated: 'Employment Status Updated',
  information_updated: 'Employee Information Updated',
}
