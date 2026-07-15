import type { InterviewStatus, InterviewType } from '@/lib/database.types'
import type { ApplicationStatus } from '@/lib/applicationStatusLabels'
import type { BadgeProps } from '@/components/ui/badge'

export const INTERVIEW_TYPE_LABEL: Record<InterviewType, string> = {
  initial: 'Initial Interview',
  final: 'Final Interview',
}

/** The 'completed' status is used as the "under interview" transitional state —
 * set the moment HR clicks Conduct Interview, before Pass/Reject is submitted. */
export const INTERVIEW_STATUS_LABEL: Record<InterviewStatus, string> = {
  scheduled: 'Scheduled',
  completed: 'Under Interview',
  passed: 'Passed',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

export const INTERVIEW_MODE_LABEL: Record<string, string> = {
  online: 'Online',
  face_to_face: 'Face-to-face',
}

export interface InterviewRow {
  interview_type: InterviewType
  status: InterviewStatus
}

/** The full pipeline stage an applicant is at, derived from the application's
 * status plus its initial/final interview rows — there is no persisted "stage"
 * column, this is computed fresh from the two interview rows (at most one per
 * stage, enforced by a unique constraint). */
export type DerivedStage =
  | 'waiting_for_initial_schedule'
  | 'initial_interview_scheduled'
  | 'under_initial_interview'
  | 'passed_initial_interview'
  | 'final_interview_scheduled'
  | 'under_final_interview'
  | 'hired'
  | 'rejected'

export const DERIVED_STAGE_LABEL: Record<DerivedStage, string> = {
  waiting_for_initial_schedule: 'Waiting for Initial Schedule',
  initial_interview_scheduled: 'Initial Interview Scheduled',
  under_initial_interview: 'Under Initial Interview',
  passed_initial_interview: 'Passed Initial Interview',
  final_interview_scheduled: 'Final Interview Scheduled',
  under_final_interview: 'Under Final Interview',
  hired: 'Hired',
  rejected: 'Rejected',
}

export const DERIVED_STAGE_VARIANT: Record<DerivedStage, BadgeProps['variant']> = {
  waiting_for_initial_schedule: 'muted',
  initial_interview_scheduled: 'secondary',
  under_initial_interview: 'warning',
  passed_initial_interview: 'secondary',
  final_interview_scheduled: 'secondary',
  under_final_interview: 'warning',
  hired: 'success',
  rejected: 'destructive',
}

export function deriveStage(
  applicationStatus: ApplicationStatus,
  initial: InterviewRow | null,
  final: InterviewRow | null
): DerivedStage {
  if (applicationStatus === 'hired') return 'hired'
  if (applicationStatus === 'rejected') return 'rejected'

  if (!initial) return 'waiting_for_initial_schedule'
  if (initial.status === 'scheduled') return 'initial_interview_scheduled'
  if (initial.status === 'completed') return 'under_initial_interview'
  if (initial.status === 'failed') return 'rejected'

  // initial.status === 'passed' from here on
  if (!final) return 'passed_initial_interview'
  if (final.status === 'scheduled') return 'final_interview_scheduled'
  if (final.status === 'completed') return 'under_final_interview'
  if (final.status === 'failed') return 'rejected'
  return 'hired'
}

/** The application statuses an applicant can hold while inside the Interview
 * Management pipeline — used for the page's Status filter. */
export const INTERVIEW_PIPELINE_STATUSES = ['qualified', 'interview_scheduled', 'hired', 'rejected'] as const

export const RATING_OPTIONS = [1, 2, 3, 4, 5] as const

export const OVERALL_RECOMMENDATION_OPTIONS = [
  { value: 'strongly_recommend', label: 'Strongly Recommend' },
  { value: 'recommend', label: 'Recommend' },
  { value: 'not_recommend', label: 'Not Recommend' },
  { value: 'strongly_not_recommend', label: 'Strongly Not Recommend' },
] as const
