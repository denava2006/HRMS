import {
  corsHeaders,
  isAllowedOrigin,
  json,
  normalizeEmail,
  requireStoreAdmin,
  safeErrorMessage,
  validatePassword,
} from "../_shared/staff-auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return isAllowedOrigin(req)
      ? new Response(null, { status: 204, headers: corsHeaders(req) })
      : json(req, { error: "Origin is not allowed." }, 403);
  }
  if (req.method !== "POST") return json(req, { error: "Method not allowed." }, 405);

  let createdUserId: string | null = null;
  try {
    const body = await req.json();
    const storeId = String(body.store_id ?? "");
    const role = String(body.role ?? "");
    if (role !== "manager" && role !== "cashier") {
      return json(req, { error: "Only Manager or Cashier accounts can be created." }, 400);
    }

    const email = normalizeEmail(body.email);
    const password = validatePassword(body.password);
    const displayName = String(body.display_name ?? "").trim().slice(0, 120) || null;
    const { admin, caller } = await requireStoreAdmin(req, storeId);

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: displayName ? { display_name: displayName } : {},
    });
    if (createError || !created.user) throw createError ?? new Error("Could not create staff account.");
    createdUserId = created.user.id;

    const { data: membership, error: membershipError } = await admin
      .from("store_memberships")
      .insert({
        store_id: storeId,
        user_id: created.user.id,
        role,
        status: "active",
        display_name: displayName,
        created_by: caller.id,
      })
      .select("id, store_id, user_id, role, status, display_name, created_at")
      .single();

    if (membershipError || !membership) {
      await admin.auth.admin.deleteUser(created.user.id);
      createdUserId = null;
      throw membershipError ?? new Error("Could not assign staff to the store.");
    }

    const { error: auditError } = await admin.from("audit_logs").insert({
      store_id: storeId,
      user_id: caller.id,
      action: "staff_created",
      entity_type: "store_membership",
      entity_id: membership.id,
      new_values: {
        staff_user_id: created.user.id,
        email,
        role,
        status: "active",
        display_name: displayName,
      },
    });
    if (auditError) {
      await admin.from("store_memberships").delete().eq("id", membership.id);
      await admin.auth.admin.deleteUser(created.user.id);
      createdUserId = null;
      throw new Error("Staff creation could not be audited, so it was rolled back.");
    }

    return json(req, {
      user: {
        id: created.user.id,
        email: created.user.email,
        created_at: created.user.created_at,
        last_sign_in_at: created.user.last_sign_in_at,
      },
      membership,
    }, 201);
  } catch (error) {
    // The explicit rollback above handles all post-creation failures. This is a
    // final safeguard for an unexpected exception after Auth user creation.
    if (createdUserId) {
      try {
        const bodyUrl = Deno.env.get("SUPABASE_URL");
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (bodyUrl && serviceKey) {
          const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.105.1");
          await createClient(bodyUrl, serviceKey).auth.admin.deleteUser(createdUserId);
        }
      } catch {
        // Do not mask the original safe error or expose credentials.
      }
    }
    const message = safeErrorMessage(error);
    const status = /Authentication required/.test(message) ? 401
      : /Admin access|required/.test(message) ? 403
      : 400;
    return json(req, { error: message }, status);
  }
});
