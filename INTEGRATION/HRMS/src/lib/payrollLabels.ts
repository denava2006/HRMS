import type { PayrollStatus } from '@/lib/enums'
import type { BadgeProps } from '@/components/ui/badge'

/** The lifecycle, in the order it happens:
 *   Draft            — period exists, payroll not computed yet
 *   Generated        — computed; HR Staff is checking and adjusting it
 *   Pending Approval — HR Staff submitted it; waiting on the HR Manager
 *   Approved         — HR Manager signed off; ready to release
 *   Rejected         — sent back to HR Staff with a reason to fix
 *   Released         — payslips generated and visible to employees
 *
 * A payroll_record walks this path per employee. A payroll_period's status is
 * an aggregate of its records, recomputed by trigger — one rejected record
 * holds the period at Rejected, because that's what HR Staff has to act on. */
export const PAYROLL_STATUS_LABEL: Record<PayrollStatus, string> = {
  draft: 'Draft',
  generated: 'Generated',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  released: 'Released',
}

export const PAYROLL_STATUS_VARIANT: Record<PayrollStatus, BadgeProps['variant']> = {
  draft: 'muted',
  generated: 'secondary',
  pending_approval: 'warning',
  approved: 'warning',
  rejected: 'destructive',
  released: 'success',
}

export const PAYROLL_FREQUENCY_LABEL: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  semi_monthly: 'Semi-monthly',
  monthly: 'Monthly',
}

export const ALLOWANCE_LABEL_PRESETS = [
  'Overtime Pay',
  'Night Differential',
  'Meal Allowance',
  'Transportation Allowance',
  'Internet Allowance',
  'Performance Incentive',
  'Other Company Benefits',
] as const

export const DEDUCTION_LABEL_PRESETS = [
  'Late Deduction',
  'Undertime Deduction',
  'Leave Without Pay',
  'Absences',
  'Cash Advance',
  'Other Company Deductions',
] as const

export const PAYROLL_AUDIT_ACTION = {
  generated: 'Payroll Generated',
  submitted: 'Payroll Submitted for Approval',
  approved: 'Payroll Approved',
  rejected: 'Payroll Rejected',
  adjusted: 'Payroll Adjusted',
  payslipGenerated: 'Payslip Generated',
  payslipReleased: 'Payslip Released',
} as const

/** Why an HR Manager sent a payroll record back. Free text is still collected
 * alongside it — the list is here so the common cases are one click and read
 * consistently in the audit log. */
export const PAYROLL_REJECTION_REASONS = [
  'Late deduction was not included',
  'Undertime or absence not reflected',
  'Overtime hours are wrong',
  'Allowance or benefit missing',
  'Statutory contribution is incorrect',
  'Basic salary does not match the employee record',
  'Other',
] as const
