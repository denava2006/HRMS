import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Tables } from '@/lib/database.types'
import { toast } from '@/components/ui/sonner'
import { APPLICATION_STATUS_LABEL } from '@/lib/applicationStatusLabels'

const APPLICATION_SELECT = `
  *,
  applicants (id, first_name, last_name, email, phone, address, resume_url, cover_letter),
  job_postings (id, title, department_id, position_id, departments (name), positions (title)),
  reviewer:profiles!applications_reviewed_by_fkey (full_name)
`

export type RecruitmentApplication = Tables<'applications'> & {
  applicants: Pick<
    Tables<'applicants'>,
    'id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'address' | 'resume_url' | 'cover_letter'
  > | null
  job_postings:
    | (Pick<Tables<'job_postings'>, 'id' | 'title' | 'department_id' | 'position_id'> & {
        departments: { name: string } | null
        positions: { title: string } | null
      })
    | null
  reviewer: { full_name: string } | null
}

export type ApplicationHistoryEntry = Tables<'application_history'> & {
  actor: { full_name: string } | null
}

const LIST_KEY = ['recruitment-applications']
const STATS_KEY = ['recruitment-stats']

export function useRecruitmentApplications() {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('applications')
        .select(APPLICATION_SELECT)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as RecruitmentApplication[]
    },
  })
}

export function useApplicationDetail(applicationId: string | undefined) {
  return useQuery({
    queryKey: [...LIST_KEY, applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('applications')
        .select(APPLICATION_SELECT)
        .eq('id', applicationId as string)
        .maybeSingle()
      if (error) throw error
      return data as unknown as RecruitmentApplication | null
    },
    enabled: !!applicationId,
  })
}

export function useApplicationHistory(applicationId: string | undefined) {
  return useQuery({
    queryKey: ['application-history', applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('application_history')
        .select('*, actor:profiles(full_name)')
        .eq('application_id', applicationId as string)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as unknown as ApplicationHistoryEntry[]
    },
    enabled: !!applicationId,
  })
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function useRecruitmentStats() {
  return useQuery({
    queryKey: STATS_KEY,
    queryFn: async () => {
      const count = (query: PromiseLike<{ count: number | null }>) => query.then((r) => r.count ?? 0)
      const [newCount, underReviewCount, qualifiedCount, rejectedCount, todayCount] = await Promise.all([
        count(supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'submitted')),
        count(supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'under_review')),
        count(supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'qualified')),
        count(supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'rejected')),
        count(supabase.from('applications').select('*', { count: 'exact', head: true }).gte('created_at', startOfToday())),
      ])
      return { newCount, underReviewCount, qualifiedCount, rejectedCount, todayCount }
    },
  })
}

function useInvalidateRecruitment() {
  const queryClient = useQueryClient()
  return (applicationId: string) => {
    queryClient.invalidateQueries({ queryKey: LIST_KEY })
    queryClient.invalidateQueries({ queryKey: STATS_KEY })
    queryClient.invalidateQueries({ queryKey: ['application-history', applicationId] })
  }
}

/** Moves a brand-new application to Under Review and logs the "reviewed"
 * history event. There are no screening fields to fill in anymore — the
 * resume itself is the record — so this is a pure status transition. */
export function useStartReview() {
  const { profile } = useAuth()
  const invalidate = useInvalidateRecruitment()
  return useMutation({
    mutationFn: async ({ applicationId }: { applicationId: string }) => {
      const { error } = await supabase
        .from('applications')
        .update({
          status: 'under_review',
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', applicationId)
      if (error) throw error

      await supabase.from('application_history').insert({
        application_id: applicationId,
        event: 'reviewed',
        actor_id: profile?.id,
      })
    },
    onSuccess: (_data, { applicationId }) => {
      invalidate(applicationId)
      toast.success('Review started')
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useMarkQualified() {
  const { profile } = useAuth()
  const invalidate = useInvalidateRecruitment()
  return useMutation({
    mutationFn: async ({ applicationId }: { applicationId: string }) => {
      const { error } = await supabase
        .from('applications')
        .update({
          status: 'qualified',
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', applicationId)
      if (error) throw error

      await supabase.from('application_history').insert({
        application_id: applicationId,
        event: 'qualified',
        actor_id: profile?.id,
      })
    },
    onSuccess: (_data, { applicationId }) => {
      invalidate(applicationId)
      toast.success('Applicant marked as qualified — ready for Interview Management')
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useRejectApplicant() {
  const { profile } = useAuth()
  const invalidate = useInvalidateRecruitment()
  return useMutation({
    mutationFn: async ({
      applicationId,
      rejectionReason,
    }: {
      applicationId: string
      rejectionReason: string
    }) => {
      const { error } = await supabase
        .from('applications')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason,
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', applicationId)
      if (error) throw error

      await supabase.from('application_history').insert([
        { application_id: applicationId, event: 'rejected', notes: rejectionReason, actor_id: profile?.id },
        {
          application_id: applicationId,
          event: 'rejection_email_queued',
          notes: 'No email provider is configured yet — this is logged only, not delivered.',
          actor_id: profile?.id,
        },
      ])
    },
    onSuccess: (_data, { applicationId }) => {
      invalidate(applicationId)
      toast.success('Applicant rejected')
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useResumeSignedUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['resume-signed-url', path],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('resumes').createSignedUrl(path as string, 300)
      if (error) throw error
      return data.signedUrl
    },
    enabled: !!path,
    staleTime: 4 * 60 * 1000,
  })
}

/** Live toasts for HR staff who have the Recruitment page open — a new
 * application arriving, or another reviewer changing an application's
 * status while you're looking at the same queue. */
export function useRecruitmentRealtimeAlerts() {
  const queryClient = useQueryClient()

  React.useEffect(() => {
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: LIST_KEY })
      queryClient.invalidateQueries({ queryKey: STATS_KEY })
    }

    const channel = supabase
      .channel('recruitment-applications-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'applications' }, () => {
        toast.info('New application received')
        refresh()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'applications' }, (payload) => {
        const oldStatus = (payload.old as { status?: string } | null)?.status
        const newStatus = (payload.new as { status?: string } | null)?.status
        if (newStatus && oldStatus && newStatus !== oldStatus) {
          const label = APPLICATION_STATUS_LABEL[newStatus as keyof typeof APPLICATION_STATUS_LABEL] ?? newStatus
          toast.info(`Application status changed to ${label}`)
        }
        refresh()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}
