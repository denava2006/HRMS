import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types'
import { toast } from '@/components/ui/sonner'

export type Department = Tables<'departments'>

const QUERY_KEY = ['departments']

export function useDepartments() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('departments').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

export function useCreateDepartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: TablesInsert<'departments'>) => {
      const { error } = await supabase.from('departments').insert(values)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Department created')
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: TablesUpdate<'departments'> }) => {
      const { error } = await supabase.from('departments').update(values).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Department updated')
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('departments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Department deleted')
    },
    onError: (error) => {
      // FK restrict on positions.department_id — surface a clear reason rather
      // than a raw Postgres error code.
      if (error.message.includes('violates foreign key constraint')) {
        toast.error('This department still has positions assigned to it. Reassign or delete those first.')
        return
      }
      toast.error(error.message)
    },
  })
}
