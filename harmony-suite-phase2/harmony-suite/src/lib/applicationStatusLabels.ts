import type { Enums } from '@/lib/database.types'
import type { BadgeProps } from '@/components/ui/badge'

export type ApplicationStatus = Enums<'application_status'>

/** The Recruitment (screening) module only ever sets these three — later
 * statuses (interview_scheduled, offered, hired, closed) belong to
 * downstream modules and are never written from here.
 *
 * 'under_review' is deliberately absent: screening is now a single decision
 * (qualify or reject) with no intermediate step. The enum value still exists
 * in the database so any historical row keeps rendering — see the label map
 * below — it's just never set or filtered on anymore. */
export const RECRUITMENT_STATUSES = ['submitted', 'qualified', 'rejected'] as const
export type RecruitmentStatus = (typeof RECRUITMENT_STATUSES)[number]

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  submitted: 'New',
  under_review: 'Under Review',
  qualified: 'Qualified',
  rejected: 'Rejected',
  interview_scheduled: 'Interview Scheduled',
  offered: 'Offered',
  hired: 'Hired',
  closed: 'Closed',
  deployed: 'Deployed',
}

export const APPLICATION_STATUS_VARIANT: Record<ApplicationStatus, BadgeProps['variant']> = {
  submitted: 'muted', // gray
  under_review: 'secondary', // blue (Ocean Blue is the brand's secondary color)
  qualified: 'success', // green
  rejected: 'destructive', // red
  interview_scheduled: 'outline',
  offered: 'outline',
  hired: 'success',
  closed: 'muted',
  deployed: 'success',
}
