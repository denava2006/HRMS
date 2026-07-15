import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from '@/components/ui/sonner'

const QUERY_KEY = ['system_settings']

export function useSystemSettings() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('system_settings').select('*').order('key')
      if (error) throw error
      // value is stored as jsonb (e.g. "PHP" including quotes) — unwrap to a plain string for form use.
      const map: Record<string, string> = {}
      for (const row of data) {
        map[row.key] = typeof row.value === 'string' ? row.value : JSON.stringify(row.value)
      }
      return map
    },
  })
}

export function useUpdateSystemSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: Record<string, string>) => {
      const rows = Object.entries(values).map(([key, value]) => ({ key, value }))
      const { error } = await supabase.from('system_settings').upsert(rows, { onConflict: 'key' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Settings saved')
    },
    onError: (error) => toast.error(error.message),
  })
}
