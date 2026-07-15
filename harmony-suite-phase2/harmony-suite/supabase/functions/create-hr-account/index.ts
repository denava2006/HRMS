// Creates a new HR Staff / Admin login for Harmony Suite.
//
// Why this has to be an Edge Function rather than a client-side call:
// creating an auth user (or setting anyone's role) requires the Supabase
// service_role key, which bypasses RLS entirely. That key must never be
// shipped to the browser, so it only ever lives in this function's
// environment. The client instead sends the caller's own access token; this
// function re-verifies that caller is an active Admin using THEIR
// permissions (not the service key) before it does anything privileged.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization header.' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Scoped to the CALLER's own token — used only to find out who they are
    // and confirm they're an active Admin. Cannot bypass RLS.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser()
    if (userError || !user) return json({ error: 'Not authenticated.' }, 401)

    const { data: callerProfile, error: profileError } = await callerClient
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single()

    if (profileError || !callerProfile || callerProfile.role !== 'admin' || callerProfile.status !== 'active') {
      return json({ error: 'Only active administrators can create accounts.' }, 403)
    }

    const body = await req.json().catch(() => null)
    const email: string | undefined = body?.email
    const fullName: string | undefined = body?.full_name
    const role: string | undefined = body?.role

    if (!email || !fullName || !role) {
      return json({ error: 'email, full_name, and role are all required.' }, 400)
    }
    if (role !== 'admin' && role !== 'hr_staff') {
      return json({ error: 'role must be "admin" or "hr_staff".' }, 400)
    }

    // Elevated client — service_role key, server-side only, never sent to the browser.
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
    })

    if (inviteError || !invited.user) {
      return json({ error: inviteError?.message ?? 'Failed to invite user.' }, 400)
    }

    // handle_new_user() already created a `profiles` row defaulting to
    // hr_staff/active — fill in the real name and requested role now.
    const { error: updateError } = await adminClient
      .from('profiles')
      .update({ full_name: fullName, role, created_by: user.id })
      .eq('id', invited.user.id)

    if (updateError) return json({ error: updateError.message }, 400)

    return json({ id: invited.user.id, email: invited.user.email })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error.' }, 500)
  }
})
