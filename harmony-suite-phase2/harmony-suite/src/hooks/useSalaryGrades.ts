import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types'
import { toast } from '@/components/ui/sonner'

export type SalaryGrade = Tables<'salary_grades'>

const QUERY_KEY = ['salary_grades']

export function useSalaryGrades() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('salary_grades').select('*').order('min_salary')
      if (error) throw error
      return data
    },
  })
}

export function useCreateSalaryGrade() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: TablesInsert<'salary_grades'>) => {
      const { error } = await supabase.from('salary_grades').insert(values)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Salary grade created')
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useUpdateSalaryGrade() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: TablesUpdate<'salary_grades'> }) => {
      const { error } = await supabase.from('salary_grades').update(values).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Salary grade updated')
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useDeleteSalaryGrade() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('salary_grades').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Salary grade deleted')
    },
    onError: (error) => {
      if (error.message.includes('violates foreign key constraint')) {
        toast.error('This salary grade is still assigned to employees.')
        return
      }
      toast.error(error.message)
    },
  })
}
