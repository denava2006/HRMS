// Creates (or resends the invite for) an employee login for Harmony Suite.
//
// Mirrors create-hr-account's shape (same reason this has to be an Edge
// Function: creating an auth user requires the service_role key, which must
// never reach the browser). The differences: any active Admin OR HR Staff
// may call this (not Admin-only), the resulting profile is role='employee'
// and linked to a specific employees row, and calling it a second time for
// the same not-yet-activated employee resends the invite instead of erroring.

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
    // and confirm they're active HR staff/admin. Cannot bypass RLS.
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

    const callerIsStaff =
      !profileError && callerProfile && ['admin', 'hr_staff'].includes(callerProfile.role) && callerProfile.status === 'active'
    if (!callerIsStaff) {
      return json({ error: 'Only active HR staff or administrators can create employee accounts.' }, 403)
    }

    const body = await req.json().catch(() => null)
    const employeeId: string | undefined = body?.employeeId
    const email: string | undefined = body?.email
    const fullName: string | undefined = body?.fullName
    const redirectTo: string | undefined = body?.redirectTo

    if (!employeeId || !email || !fullName) {
      return json({ error: 'employeeId, email, and fullName are all required.' }, 400)
    }

    // Elevated client — service_role key, server-side only, never sent to the browser.
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: employeeRow, error: employeeError } = await adminClient
      .from('employees')
      .select('id')
      .eq('id', employeeId)
      .single()
    if (employeeError || !employeeRow) return json({ error: 'Employee record not found.' }, 404)

    const { data: existingProfile, error: existingProfileError } = await adminClient
      .from('profiles')
      .select('id, activated_at')
      .eq('employee_id', employeeId)
      .maybeSingle()
    if (existingProfileError) return json({ error: existingProfileError.message }, 400)

    if (existingProfile && existingProfile.activated_at) {
      return json({ error: 'This employee’s account has already been activated.' }, 400)
    }

    const isResend = !!existingProfile

    // redirectTo comes from the caller's own origin so the invite email works
    // in both dev and prod without hardcoding a host here. Supabase only
    // honors it if it's in the project's Redirect URLs allow list — otherwise
    // it silently falls back to the configured Site URL.
    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      redirectTo,
    })

    if (inviteError || !invited.user) {
      return json({ error: inviteError?.message ?? 'Failed to invite user.' }, 400)
    }

    // handle_new_user() already created a `profiles` row on first invite
    // (defaulting to hr_staff/inactive) — overwrite it for an employee login.
    // On resend, invited.user.id is the SAME auth user as before (Supabase
    // resends rather than recreating), so this update just refreshes invited_at.
    const { error: updateError } = await adminClient
      .from('profiles')
      .update({
        full_name: fullName,
        role: 'employee',
        status: 'active',
        employee_id: employeeId,
        created_by: user.id,
        invited_at: new Date().toISOString(),
      })
      .eq('id', invited.user.id)

    if (updateError) return json({ error: updateError.message }, 400)

    await adminClient.from('employee_history').insert({
      employee_id: employeeId,
      event: isResend ? 'invitation_resent' : 'account_created',
      actor_id: user.id,
    })
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: isResend ? 'Invitation Email Resent' : 'Employee Account Created',
      table_name: 'employees',
      record_id: employeeId,
    })

    return json({ id: invited.user.id, email: invited.user.email, resent: isResend })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error.' }, 500)
  }
})
