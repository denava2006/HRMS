import type { PayrollStatus } from '@/lib/database.types'
import type { BadgeProps } from '@/components/ui/badge'

/** The lifecycle, in the order it happens:
 *   Draft     — computed, still being checked by HR Staff
 *   Approved  — HR Manager signed off; ready to release  (enum value: 'reviewed')
 *   Released  — payslips generated and visible to employees
 * 'reviewed' keeps its database name; "Approved" is what it means to a user. */
export const PAYROLL_STATUS_LABEL: Record<PayrollStatus, string> = {
  draft: 'Draft',
  reviewed: 'Approved',
  released: 'Released',
}

export const PAYROLL_STATUS_VARIANT: Record<PayrollStatus, BadgeProps['variant']> = {
  draft: 'muted',
  reviewed: 'warning',
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
  'Holiday Pay',
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
  reviewed: 'Payroll Reviewed',
  adjusted: 'Payroll Adjusted',
  payslipGenerated: 'Payslip Generated',
  payslipReleased: 'Payslip Released',
} as const
