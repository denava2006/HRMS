import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types'
import { toast } from '@/components/ui/sonner'

export type WorkSchedule = Tables<'work_schedules'>

const QUERY_KEY = ['work_schedules']

export function useWorkSchedules() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('work_schedules').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

export function useCreateWorkSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: TablesInsert<'work_schedules'>) => {
      const { error } = await supabase.from('work_schedules').insert(values)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Work schedule created')
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useUpdateWorkSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: TablesUpdate<'work_schedules'> }) => {
      const { error } = await supabase.from('work_schedules').update(values).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Work schedule updated')
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useDeleteWorkSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('work_schedules').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Work schedule deleted')
    },
    onError: (error) => {
      if (error.message.includes('violates foreign key constraint')) {
        toast.error('This schedule is still assigned to employees.')
        return
      }
      toast.error(error.message)
    },
  })
}
