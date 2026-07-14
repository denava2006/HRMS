import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function getProfile(userId: string): Promise<{ data: Profile | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) return { data: null, error: new Error(error.message) }
  return { data: data as Profile, error: null }
}

export async function getSession() {
  return supabase.auth.getSession()
}
