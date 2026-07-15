import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types'
import { toast } from '@/components/ui/sonner'

export type JobPosting = Tables<'job_postings'> & {
  departments: { name: string } | null
  positions: { title: string } | null
}

const QUERY_KEY = ['job_postings']

export function useJobPostings() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_postings')
        .select('*, departments(name), positions(title)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as JobPosting[]
    },
  })
}

export type JobPostingFormInput = Omit<TablesInsert<'job_postings'>, 'posted_by' | 'date_posted'>

export function useCreateJobPosting() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  return useMutation({
    mutationFn: async (values: JobPostingFormInput) => {
      const payload: TablesInsert<'job_postings'> = {
        ...values,
        posted_by: profile?.id,
        date_posted: values.status === 'open' ? new Date().toISOString() : null,
      }
      const { error } = await supabase.from('job_postings').insert(payload)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Job posting created')
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useUpdateJobPosting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      values,
      wasOpen,
    }: {
      id: string
      values: JobPostingFormInput
      /** Whether the posting was already 'open' before this edit, so we don't re-stamp date_posted. */
      wasOpen: boolean
    }) => {
      const payload: TablesUpdate<'job_postings'> = { ...values }
      if (values.status === 'open' && !wasOpen) {
        payload.date_posted = new Date().toISOString()
      }
      const { error } = await supabase.from('job_postings').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Job posting updated')
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useDeleteJobPosting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('job_postings').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Job posting deleted')
    },
    onError: (error) => {
      if (error.message.includes('violates foreign key constraint')) {
        toast.error('This posting still has applications on file and can’t be deleted. Close it instead.')
        return
      }
      toast.error(error.message)
    },
  })
}
