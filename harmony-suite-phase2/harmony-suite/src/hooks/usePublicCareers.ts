import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'

export type PublicJobPosting = Tables<'job_postings'> & {
  departments: { name: string } | null
  positions: { title: string } | null
}

const JOB_POSTINGS_SELECT = '*, departments(name), positions(title)'
const QUERY_KEY = ['public-job-postings']

/** Any posting readable here is already status = 'open' — enforced by the anon RLS policy, not client-side filtering. */
export function usePublicOpenJobPostings() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_postings')
        .select(JOB_POSTINGS_SELECT)
        .order('date_posted', { ascending: false, nullsFirst: false })
      if (error) throw error
      return data as PublicJobPosting[]
    },
    staleTime: 60_000,
  })
}

export function usePublicJobPosting(jobId: string | undefined) {
  return useQuery({
    queryKey: [...QUERY_KEY, jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_postings')
        .select(JOB_POSTINGS_SELECT)
        .eq('id', jobId as string)
        .maybeSingle()
      if (error) throw error
      return data as PublicJobPosting | null
    },
    enabled: !!jobId,
    staleTime: 60_000,
  })
}

/** True once a posting's own closing date has passed, even if HR hasn't flipped its status to 'closed' yet. */
export function isPastClosingDate(closingDate: string | null): boolean {
  if (!closingDate) return false
  const today = new Date()
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return closingDate < todayIso
}

export function isAcceptingApplications(posting: Pick<PublicJobPosting, 'status' | 'closing_date'>): boolean {
  return posting.status === 'open' && !isPastClosingDate(posting.closing_date)
}

const ALLOWED_RESUME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const MAX_RESUME_BYTES = 5 * 1024 * 1024

export function validateResumeFile(file: File): string | null {
  if (!ALLOWED_RESUME_TYPES.includes(file.type)) {
    return 'Only PDF, DOC, or DOCX files are accepted.'
  }
  if (file.size > MAX_RESUME_BYTES) {
    return 'File is too large — the maximum size is 5 MB.'
  }
  return null
}

async function uploadResume(jobPostingId: string, file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? 'pdf'
  const path = `${jobPostingId}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from('resumes').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw new Error('Could not upload your resume. Please try again.')
  return path
}

export interface SubmitApplicationInput {
  jobPostingId: string
  firstName: string
  middleName: string
  lastName: string
  email: string
  phone: string
  address: string
  coverLetter?: string
  resumeFile: File
}

const FRIENDLY_APPLICATION_ERRORS: Record<string, string> = {
  JOB_NOT_FOUND: 'This job posting could not be found.',
  JOB_CLOSED: 'This job posting is no longer accepting applications.',
  DUPLICATE_APPLICATION: 'You’ve already applied to this job with this email address.',
}

export function useSubmitApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: SubmitApplicationInput) => {
      const resumePath = await uploadResume(input.jobPostingId, input.resumeFile)

      const { data, error } = await supabase.rpc('submit_job_application', {
        p_job_posting_id: input.jobPostingId,
        p_first_name: input.firstName,
        p_middle_name: input.middleName || undefined,
        p_last_name: input.lastName,
        p_email: input.email,
        p_phone: input.phone,
        p_address: input.address,
        p_resume_path: resumePath,
        p_cover_letter: input.coverLetter || undefined,
      })

      if (error) {
        const friendly = FRIENDLY_APPLICATION_ERRORS[error.message]
        throw new Error(friendly ?? 'We couldn’t submit your application. Please try again.')
      }

      return data?.[0] ?? null
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}
