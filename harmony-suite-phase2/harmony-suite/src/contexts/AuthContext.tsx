import * as React from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  /** True while the initial session is being restored on page load. */
  initializing: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error) {
    console.error('Failed to load profile for signed-in user:', error.message)
    return null
  }
  return data
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null)
  const [profile, setProfile] = React.useState<Profile | null>(null)
  const [initializing, setInitializing] = React.useState(true)

  React.useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!isMounted) return
      setSession(data.session)
      if (data.session) {
        setProfile(await fetchProfile(data.session.user.id))
      }
      setInitializing(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!isMounted) return
      setSession(nextSession)
      setProfile(nextSession ? await fetchProfile(nextSession.user.id) : null)
    })

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const signIn = React.useCallback(async (email: string, password: string) => {
    // "Authentication Success?" — No branch: Supabase rejects the credentials.
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return { error: 'That email and password combination doesn\u2019t match our records.' }
    }

    const activeProfile = await fetchProfile(data.user.id)

    // A deactivated HR/Admin account should not be able to sign in, even with
    // valid credentials (mirrors Admin's "Deactivate HR Account" action).
    if (!activeProfile || activeProfile.status !== 'active') {
      await supabase.auth.signOut()
      return { error: 'This account has been deactivated. Contact your administrator.' }
    }

    void supabase
      .from('profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', data.user.id)
      .then(({ error: updateError }) => {
        if (updateError) console.error('Failed to record last login:', updateError.message)
      })

    setProfile(activeProfile)
    return { error: null }
  }, [])

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
  }, [])

  const value = React.useMemo(
    () => ({ session, profile, initializing, signIn, signOut }),
    [session, profile, initializing, signIn, signOut]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
