import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types'
import { toast } from '@/components/ui/sonner'

export type Holiday = Tables<'holidays'>

const QUERY_KEY = ['holidays']

export function useHolidays() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('holidays').select('*').order('holiday_date')
      if (error) throw error
      return data
    },
  })
}

export function useCreateHoliday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: TablesInsert<'holidays'>) => {
      const { error } = await supabase.from('holidays').insert(values)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Holiday added')
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useUpdateHoliday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: TablesUpdate<'holidays'> }) => {
      const { error } = await supabase.from('holidays').update(values).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Holiday updated')
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useDeleteHoliday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('holidays').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Holiday deleted')
    },
    onError: (error) => toast.error(error.message),
  })
}
