import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types'
import { toast } from '@/components/ui/sonner'

export type Position = Tables<'positions'> & { departments: { name: string } | null }

const QUERY_KEY = ['positions']

export function usePositions() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('positions')
        .select('*, departments(name)')
        .order('title')
      if (error) throw error
      return data as Position[]
    },
  })
}

export function useCreatePosition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: TablesInsert<'positions'>) => {
      const { error } = await supabase.from('positions').insert(values)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Position created')
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useUpdatePosition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: TablesUpdate<'positions'> }) => {
      const { error } = await supabase.from('positions').update(values).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Position updated')
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useDeletePosition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('positions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Position deleted')
    },
    onError: (error) => {
      if (error.message.includes('violates foreign key constraint')) {
        toast.error('This position is still assigned to employees or job postings.')
        return
      }
      toast.error(error.message)
    },
  })
}
