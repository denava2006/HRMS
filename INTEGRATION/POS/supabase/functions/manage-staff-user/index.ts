import {
  corsHeaders,
  isAllowedOrigin,
  json,
  requireStoreAdmin,
  safeErrorMessage,
  validatePassword,
} from "../_shared/staff-auth.ts";

const editableRoles = new Set(["manager", "cashier"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return isAllowedOrigin(req)
      ? new Response(null, { status: 204, headers: corsHeaders(req) })
      : json(req, { error: "Origin is not allowed." }, 403);
  }
  if (req.method !== "POST") return json(req, { error: "Method not allowed." }, 405);

  try {
    const body = await req.json();
    const storeId = String(body.store_id ?? "");
    const action = String(body.action ?? "");
    const { admin, caller } = await requireStoreAdmin(req, storeId);

    if (action === "list") {
      const { data: memberships, error } = await admin
        .from("store_memberships")
        .select("id, user_id, role, status, display_name, created_at, updated_at")
        .eq("store_id", storeId)
        .in("role", ["manager", "cashier"])
        .order("created_at");
      if (error) throw error;

      const staff = await Promise.all((memberships ?? []).map(async (membership) => {
        const { data } = await admin.auth.admin.getUserById(membership.user_id);
        return {
          ...membership,
          email: data.user?.email ?? null,
          last_sign_in_at: data.user?.last_sign_in_at ?? null,
        };
      }));
      return json(req, { staff });
    }

    const membershipId = String(body.membership_id ?? "");
    const { data: membership, error: membershipError } = await admin
      .from("store_memberships")
      .select("id, user_id, store_id, role, status, display_name")
      .eq("id", membershipId)
      .eq("store_id", storeId)
      .in("role", ["manager", "cashier"])
      .maybeSingle();
    if (membershipError || !membership) throw new Error("Staff membership was not found.");

    if (action === "change_role") {
      const role = String(body.role ?? "");
      if (!editableRoles.has(role)) throw new Error("Role must be Manager or Cashier.");
      if (role === membership.role) return json(req, { membership });

      const { data: updated, error } = await admin
        .from("store_memberships")
        .update({ role })
        .eq("id", membership.id)
        .select("id, user_id, role, status, display_name, created_at, updated_at")
        .single();
      if (error) throw error;
      const { error: auditError } = await admin.from("audit_logs").insert({
        store_id: storeId,
        user_id: caller.id,
        action: "staff_role_changed",
        entity_type: "store_membership",
        entity_id: membership.id,
        old_values: { role: membership.role },
        new_values: { role },
      });
      if (auditError) {
        await admin.from("store_memberships").update({ role: membership.role }).eq("id", membership.id);
        throw new Error("The role change could not be audited, so it was rolled back.");
      }
      return json(req, { membership: updated });
    }

    if (action === "set_status") {
      const status = String(body.status ?? "");
      if (status !== "active" && status !== "inactive") throw new Error("Invalid staff status.");
      if (status === membership.status) return json(req, { membership });

      const { data: updated, error } = await admin
        .from("store_memberships")
        .update({ status })
        .eq("id", membership.id)
        .select("id, user_id, role, status, display_name, created_at, updated_at")
        .single();
      if (error) throw error;
      const { error: auditError } = await admin.from("audit_logs").insert({
        store_id: storeId,
        user_id: caller.id,
        action: status === "active" ? "staff_activated" : "staff_deactivated",
        entity_type: "store_membership",
        entity_id: membership.id,
        old_values: { status: membership.status },
        new_values: { status },
      });
      if (auditError) {
        await admin.from("store_memberships").update({ status: membership.status }).eq("id", membership.id);
        throw new Error("The status change could not be audited, so it was rolled back.");
      }
      return json(req, { membership: updated });
    }

    if (action === "reset_password") {
      // The password itself is only ever passed to GoTrue. It is never logged,
      // never written to an application table, and never placed in a URL.
      const password = validatePassword(body.password);

      // Do the Auth update FIRST, so an audit row can only ever describe a
      // change that really happened.
      const { error: updateError } = await admin.auth.admin.updateUserById(
        membership.user_id,
        { password },
      );
      if (updateError) throw updateError;

      // Cross-service limitation: GoTrue and Postgres are separate services, so
      // this cannot be one transaction. The password change is already
      // committed at this point and cannot be rolled back, so a failed audit
      // insert is reported as a warning instead of a false failure — reporting
      // failure here would tell the Admin the reset did not happen when it did.
      const { error: auditError } = await admin.from("audit_logs").insert({
        store_id: storeId,
        user_id: caller.id,
        action: "staff_password_reset",
        entity_type: "store_membership",
        entity_id: membership.id,
        new_values: { reset_by_admin: true },
      });
      if (auditError) {
        return json(req, {
          success: true,
          audit_recorded: false,
          warning: "The password was reset, but the audit entry could not be recorded.",
        });
      }
      return json(req, { success: true, audit_recorded: true });
    }

    return json(req, { error: "Unsupported action." }, 400);
  } catch (error) {
    const message = safeErrorMessage(error);
    const status = /Authentication required/.test(message) ? 401
      : /Admin access|required/.test(message) ? 403
      : 400;
    return json(req, { error: message }, status);
  }
});
