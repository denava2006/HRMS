import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Enums } from '@/lib/database.types'

/** One row from lookup_application(). Applicants are not Auth users — every
 * call carries the reference code plus the email the application was submitted
 * with, and the RPC does the matching server-side. */
export interface ApplicationTrackingRecord {
  reference_code: string
  status: Enums<'application_status'>
  submitted_at: string
  applicant_name: string
  position_title: string | null
  department_name: string | null
  interview_type: Enums<'interview_type'> | null
  interview_scheduled_at: string | null
  interview_mode: string | null
  interview_location: string | null
  interview_meeting_link: string | null
  interview_status: Enums<'interview_status'> | null
  offer_id: string | null
  offer_status: Enums<'offer_status'> | null
  offer_employment_type: Enums<'employment_type'> | null
  offer_salary: number | null
  offer_currency: string | null
  offer_start_date: string | null
  offer_working_hours: string | null
  offer_working_days: string | null
  offer_benefits: string | null
  offer_additional_compensation: string | null
}

export interface ApplicantCredentials {
  referenceCode: string
  email: string
}

const TRACKING_KEY = ['application-tracking']

export function useApplicationTracking(credentials: ApplicantCredentials | null) {
  return useQuery({
    queryKey: [...TRACKING_KEY, credentials?.referenceCode, credentials?.email],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('lookup_application', {
        p_reference_code: credentials!.referenceCode,
        p_email: credentials!.email,
      })
      if (error) throw new Error('We couldn’t check that application. Please try again.')
      const row = (data as unknown as ApplicationTrackingRecord[] | null)?.[0] ?? null
      if (!row) {
        throw new Error('No application matches that reference number and email address.')
      }
      return row
    },
    enabled: !!credentials,
    retry: false,
  })
}

const FRIENDLY_RESPONSE_ERRORS: Record<string, string> = {
  NOT_FOUND: 'No application matches that reference number and email address.',
  NO_OFFER: 'There’s no job offer on this application yet.',
  ALREADY_RESPONDED: 'You’ve already responded to this offer.',
  INVALID_DECISION: 'That response isn’t valid.',
}

export function useRespondToOfferAsApplicant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      credentials,
      decision,
    }: {
      credentials: ApplicantCredentials
      decision: 'accepted' | 'declined'
    }) => {
      const { error } = await supabase.rpc('respond_to_job_offer', {
        p_reference_code: credentials.referenceCode,
        p_email: credentials.email,
        p_decision: decision,
      })
      if (error) {
        throw new Error(FRIENDLY_RESPONSE_ERRORS[error.message] ?? 'We couldn’t record your response. Please try again.')
      }
      return decision
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRACKING_KEY })
    },
  })
}

/** Plain-language status for the applicant. The internal labels
 * (applicationStatusLabels.ts) are written for HR and leak process detail an
 * applicant shouldn't be reading. */
export const APPLICANT_STATUS_COPY: Record<Enums<'application_status'>, { label: string; detail: string }> = {
  submitted: {
    label: 'Application Received',
    detail: 'We’ve received your application and it’s waiting to be screened.',
  },
  under_review: {
    label: 'Under Review',
    detail: 'Our HR team is reviewing your application.',
  },
  qualified: {
    label: 'Shortlisted',
    detail: 'You’ve been shortlisted. We’ll be in touch to arrange an interview.',
  },
  interview_scheduled: {
    label: 'Interview Scheduled',
    detail: 'Your interview details are below — please make a note of the date and time.',
  },
  offered: {
    label: 'Job Offer',
    detail: 'Congratulations — you’ve received a job offer. Review it below and let us know your decision.',
  },
  hired: {
    label: 'Offer Stage',
    detail: 'You’ve passed the interview process. Your job offer is being prepared.',
  },
  deployed: {
    label: 'Welcome Aboard',
    detail: 'Your onboarding is complete. Welcome to the team!',
  },
  rejected: {
    label: 'Not Successful',
    detail: 'Thank you for your interest. We won’t be moving forward with this application.',
  },
  closed: {
    label: 'Closed',
    detail: 'This application has been closed.',
  },
}
