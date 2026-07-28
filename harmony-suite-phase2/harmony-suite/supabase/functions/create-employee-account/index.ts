// Creates an employee login for Harmony Suite.
//
// Mirrors create-hr-account's shape (same reason this has to be an Edge
// Function: creating an auth user requires the service_role key, which must
// never reach the browser; same reason it uses a fixed default password
// instead of an emailed invite link — see DEFAULT_EMPLOYEE_PASSWORD below).
// The differences: any active Admin OR HR Staff may call this (not
// Admin-only), and the resulting profile is role='employee' and linked to a
// specific employees row.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// This app runs on a per-deployer local Supabase stack (see README) rather
// than one shared mailbox-reachable project, so an email-invite link can
// never reach a real inbox for anyone other than whoever is running it
// locally. Accounts are created immediately active with this fixed, publicly
// documented default password instead — the login email is always the
// applicant's own email, carried through from their job application.
const DEFAULT_EMPLOYEE_PASSWORD = 'Employee123'

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
      .select('id')
      .eq('employee_id', employeeId)
      .maybeSingle()
    if (existingProfileError) return json({ error: existingProfileError.message }, 400)

    // With a fixed default password there's no "pending activation" state left
    // to resend for — every account this function creates is fully usable the
    // moment it's created, so a second call for the same employee is always
    // a duplicate, not a resend.
    if (existingProfile) {
      return json({ error: 'This employee already has an account.' }, 400)
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: DEFAULT_EMPLOYEE_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

    if (createError || !created.user) {
      return json({ error: createError?.message ?? 'Failed to create account.' }, 400)
    }

    // handle_new_user() already created a `profiles` row (defaulting to
    // hr_staff/inactive) — overwrite it for an employee login. activated_at is
    // stamped immediately since there's no separate password-creation step
    // left to wait on (see DEFAULT_EMPLOYEE_PASSWORD above).
    const now = new Date().toISOString()
    const { error: updateError } = await adminClient
      .from('profiles')
      .update({
        full_name: fullName,
        role: 'employee',
        status: 'active',
        employee_id: employeeId,
        created_by: user.id,
        invited_at: now,
        activated_at: now,
      })
      .eq('id', created.user.id)

    if (updateError) return json({ error: updateError.message }, 400)

    await adminClient.from('employee_history').insert({
      employee_id: employeeId,
      event: 'account_created',
      actor_id: user.id,
    })
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'Employee Account Created',
      table_name: 'employees',
      record_id: employeeId,
    })

    return json({ id: created.user.id, email: created.user.email, password: DEFAULT_EMPLOYEE_PASSWORD })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error.' }, 500)
  }
})
