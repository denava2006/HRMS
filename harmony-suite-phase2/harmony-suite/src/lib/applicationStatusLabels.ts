import type { Enums } from '@/lib/database.types'
import type { BadgeProps } from '@/components/ui/badge'

export type ApplicationStatus = Enums<'application_status'>

/** The Recruitment (screening) module only ever sets these four — later
 * statuses (interview_scheduled, offered, hired, closed) belong to
 * downstream modules and are never written from here. */
export const RECRUITMENT_STATUSES = ['submitted', 'under_review', 'qualified', 'rejected'] as const
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
}
