import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Tables, UserRole } from '@/lib/database.types'
import { toast } from '@/components/ui/sonner'

/**
 * supabase.functions.invoke() throws a FunctionsHttpError whose `.message` is
 * always the generic "Edge Function returned a non-2xx status code" — the
 * actual `{ error: "..." }` body our function returns has to be read
 * separately from `error.context` (the raw Response). Without this, every
 * edge function failure surfaces as that one unhelpful string regardless of
 * the real reason (duplicate email, permission denied, etc).
 */
async function describeFunctionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null)
    if (body?.error) return body.error
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

export type HrAccount = Tables<'profiles'>

const QUERY_KEY = ['hr_accounts']

export function useHrAccounts() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('full_name')
      if (error) throw error
      return data
    },
  })
}

interface CreateHrAccountInput {
  email: string
  full_name: string
  role: UserRole
}

export function useCreateHrAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateHrAccountInput) => {
      const { data, error } = await supabase.functions.invoke('create-hr-account', {
        body: input,
      })
      if (error) throw new Error(await describeFunctionError(error))
      if (data?.error) throw new Error(data.error)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Account created — an invite email has been sent.')
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useUpdateHrAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: { full_name?: string; role?: UserRole } }) => {
      const { error } = await supabase.from('profiles').update(values).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Account updated')
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useSetAccountStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'inactive' }) => {
      const { error } = await supabase.from('profiles').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success(variables.status === 'active' ? 'Account reactivated' : 'Account deactivated')
    },
    onError: (error) => toast.error(error.message),
  })
}
