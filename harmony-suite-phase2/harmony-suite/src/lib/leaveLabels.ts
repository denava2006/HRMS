import type { LeaveRequestStatus } from '@/lib/database.types'
import type { BadgeProps } from '@/components/ui/badge'

export const LEAVE_STATUS_LABEL: Record<LeaveRequestStatus, string> = {
  pending: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

export const LEAVE_STATUS_VARIANT: Record<LeaveRequestStatus, BadgeProps['variant']> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
  cancelled: 'muted',
}

export const LEAVE_REJECTION_REASON_PRESETS = [
  'Insufficient Leave Credits',
  'Department Staffing Requirement',
  'Incomplete Documents',
  'Invalid Leave Request',
  'Other',
] as const

export const LEAVE_BALANCE_ADJUSTMENT_REASON_PRESETS = [
  'Annual Leave Credit Reset',
  'Additional Leave Credits',
  'Correction',
  'Company Incentive',
  'Other',
] as const

export const LEAVE_HISTORY_EVENT_LABEL: Record<string, string> = {
  leave_request_submitted: 'Leave Request Submitted',
  leave_reviewed: 'Leave Reviewed',
  leave_approved: 'Leave Approved',
  leave_credits_deducted: 'Leave Credits Deducted',
  leave_balance_updated: 'Leave Balance Updated',
  leave_record_saved: 'Leave Record Saved',
  leave_rejected: 'Leave Rejected',
  employee_notified: 'Employee Notified',
}
