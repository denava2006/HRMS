import type { EmploymentStatus } from '@/lib/database.types'
import type { BadgeProps } from '@/components/ui/badge'

export const EMPLOYMENT_STATUS_LABEL: Record<EmploymentStatus, string> = {
  active: 'Active',
  probationary: 'Probationary',
  regular: 'Regular',
  contractual: 'Contractual',
  temporary: 'Temporary',
  on_leave: 'On Leave',
  resigned: 'Resigned',
  terminated: 'Terminated',
  retired: 'Retired',
}

export const EMPLOYMENT_STATUS_VARIANT: Record<EmploymentStatus, BadgeProps['variant']> = {
  active: 'success',
  probationary: 'outline',
  regular: 'success',
  contractual: 'secondary',
  temporary: 'secondary',
  on_leave: 'warning',
  resigned: 'muted',
  terminated: 'destructive',
  retired: 'muted',
}

export const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Widowed', 'Separated', 'Divorced'] as const

export const DOCUMENT_TYPE_OPTIONS = [
  'Resume',
  'Employment Contract',
  'Government ID',
  'Birth Certificate',
  'Medical Certificate',
  'NBI Clearance',
  'Diploma',
  'Transcript',
  'Certificate',
  'Other',
] as const

export const EMPLOYEE_HISTORY_EVENT_LABEL: Record<string, string> = {
  record_created: 'Employee Record Created',
  employee_id_generated: 'Employee ID Generated',
  account_created: 'Employee Account Created',
  invitation_sent: 'Invitation Email Sent',
  invitation_resent: 'Invitation Email Resent',
  account_activated: 'Employee Activated Account',
  account_disabled: 'Employee Account Disabled',
  documents_uploaded: 'Documents Uploaded',
  department_assigned: 'Department Assigned',
  position_assigned: 'Position Assigned',
  status_updated: 'Employment Status Updated',
  information_updated: 'Employee Information Updated',
}
