// Creates a new HR Staff login for Harmony Suite.
//
// Why this has to be an Edge Function rather than a client-side call:
// creating an auth user (or setting anyone's role) requires the Supabase
// service_role key, which bypasses RLS entirely. That key must never be
// shipped to the browser, so it only ever lives in this function's
// environment. The client instead sends the caller's own access token; this
// function re-verifies that caller is an active Admin using THEIR
// permissions (not the service key) before it does anything privileged.
//
// This app runs on a per-deployer local Supabase stack (see README) rather
// than one shared mailbox-reachable project, so an email-invite link can
// never reach a real inbox for anyone other than whoever is running it
// locally. Accounts are created immediately active with this fixed, publicly
// documented default password instead — the same tradeoff already made for
// the seeded admin login (supabase/seed.sql).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Keyed by role. 'admin' is deliberately absent -- see the role validation below.
const DEFAULT_PASSWORD: Record<string, string> = {
  hr_staff: 'HrStaff123',
  hr_manager: 'HrManager123',
}
const CREATABLE_ROLES = Object.keys(DEFAULT_PASSWORD)

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
    const role: string = body?.role ?? 'hr_staff'

    if (!email || !fullName) {
      return json({ error: 'email and full_name are both required.' }, 400)
    }

    // The system never creates additional Administrators, from the UI or
    // otherwise — the lone Administrator account is provisioned outside this
    // app. A caller sending role: "admin" is rejected here, and the database
    // trigger (protect_admin_accounts) would reject the profile update anyway.
    if (!CREATABLE_ROLES.includes(role)) {
      return json({ error: `role must be one of: ${CREATABLE_ROLES.join(', ')}.` }, 400)
    }
    const password = DEFAULT_PASSWORD[role]

    // Elevated client — service_role key, server-side only, never sent to the browser.
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // See DEFAULT_PASSWORD above for why this is a fixed password rather than
    // an emailed invite link. email_confirm: true skips Auth's own "confirm
    // your email" gate — there's no inbox to confirm from here either.
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

    if (createError || !created.user) {
      return json({ error: createError?.message ?? 'Failed to create account.' }, 400)
    }

    // handle_new_user() already created a `profiles` row (defaulting to
    // hr_staff/inactive) — fill in the real name and activate it now.
    // activated_at is stamped immediately too: with a fixed default password
    // there's no separate "create your password" step left to wait on, so the
    // account is fully usable the moment this returns.
    const now = new Date().toISOString()
    const { error: updateError } = await adminClient
      .from('profiles')
      .update({ full_name: fullName, role, status: 'active', created_by: user.id, invited_at: now, activated_at: now })
      .eq('id', created.user.id)

    if (updateError) return json({ error: updateError.message }, 400)

    return json({ id: created.user.id, email: created.user.email, role, password })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error.' }, 500)
  }
})
