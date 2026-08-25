import { supabase } from "@/integrations/supabase/client";
import type { AppRole, MembershipStatus } from "@/lib/auth";
import { logTechnicalError } from "@/lib/errors";

export type StaffMember = {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: Extract<AppRole, "manager" | "cashier">;
  status: MembershipStatus;
  created_at: string;
  updated_at: string;
  last_sign_in_at: string | null;
};

/** Raised for every staff-service failure, carrying a message safe to display. */
export class StaffServiceError extends Error {
  readonly status: number | null;
  /** True when the Edge Function could not be reached at all. */
  readonly unavailable: boolean;

  constructor(message: string, status: number | null, unavailable: boolean) {
    super(message);
    this.name = "StaffServiceError";
    this.status = status;
    this.unavailable = unavailable;
  }
}

export const STAFF_SERVICE_UNAVAILABLE =
  "Staff service is unavailable. The local Edge Functions are not running — " +
  "run `npx supabase start`, then try again.";

/**
 * supabase-js collapses every non-2xx response into the same opaque
 * "Edge Function returned a non-2xx status code" and keeps the real response on
 * `error.context`. Without unwrapping it, a clean 403 is indistinguishable from
 * a crashed container, and the function's own careful wording never reaches the
 * operator. Nothing here surfaces a stack trace, a URL or a header.
 */
export async function describeFunctionError(
  error: unknown
): Promise<{ message: string; status: number | null; unavailable: boolean }> {
  const context = (error as { context?: unknown } | null)?.context;
  const raw = error instanceof Error ? error.message : String(error ?? "");
  let status: number | null = null;
  let serverMessage = "";

  if (context instanceof Response) {
    status = context.status;
    try {
      const payload = await context.clone().json();
      const candidate = payload?.error ?? payload?.msg ?? payload?.message;
      if (typeof candidate === "string" && candidate.trim()) serverMessage = candidate.trim();
    } catch {
      // A non-JSON body (an HTML gateway page, say) tells us nothing useful.
    }
  }

  // 502/503/504 come from the gateway when the functions container is down;
  // a transport failure never produces a status at all.
  const unreachable =
    status === 502 || status === 503 || status === 504 ||
    (status === null && /failed to fetch|fetch failed|network|load failed|econnrefused/i.test(raw));

  if (unreachable) return { message: STAFF_SERVICE_UNAVAILABLE, status, unavailable: true };
  if (serverMessage) return { message: serverMessage, status, unavailable: false };
  if (status === 401) return { message: "Your session has expired. Sign in again.", status, unavailable: false };
  if (status === 403) return { message: "You do not have permission to manage staff.", status, unavailable: false };
  return { message: "The staff service rejected that request. Please try again.", status, unavailable: false };
}

async function invoke<T>(functionName: string, body: Record<string, unknown>): Promise<T> {
  let data: unknown;
  let error: unknown;
  try {
    ({ data, error } = await supabase.functions.invoke(functionName, { body }));
  } catch (thrown) {
    error = thrown;
  }

  if (error) {
    logTechnicalError(`adminApi.${functionName}`, error);
    const { message, status, unavailable } = await describeFunctionError(error);
    throw new StaffServiceError(message, status, unavailable);
  }

  // A 200 response can still carry an application-level error field.
  const payload = data as { error?: unknown } | null;
  if (typeof payload?.error === "string") throw new StaffServiceError(payload.error, 200, false);
  return data as T;
}

export async function listStaff(storeId: string): Promise<StaffMember[]> {
  const data = await invoke<{ staff: StaffMember[] }>("manage-staff-user", {
    action: "list",
    store_id: storeId,
  });
  return data.staff;
}

export async function createStaff(input: {
  storeId: string;
  email: string;
  password: string;
  displayName?: string;
  role: "manager" | "cashier";
}) {
  return invoke("create-staff-user", {
    store_id: input.storeId,
    email: input.email,
    password: input.password,
    display_name: input.displayName,
    role: input.role,
  });
}

export async function changeStaffRole(storeId: string, membershipId: string, role: "manager" | "cashier") {
  return invoke("manage-staff-user", {
    action: "change_role",
    store_id: storeId,
    membership_id: membershipId,
    role,
  });
}

export async function setStaffStatus(storeId: string, membershipId: string, status: MembershipStatus) {
  return invoke("manage-staff-user", {
    action: "set_status",
    store_id: storeId,
    membership_id: membershipId,
    status,
  });
}

export type PasswordResetResult = {
  success: boolean;
  audit_recorded?: boolean;
  warning?: string;
};

/**
 * The temporary password is sent once to the Edge Function over the local
 * HTTPS/HTTP loopback and is never stored, logged or placed in a URL here.
 */
export async function resetStaffPassword(
  storeId: string,
  membershipId: string,
  password: string
): Promise<PasswordResetResult> {
  return invoke<PasswordResetResult>("manage-staff-user", {
    action: "reset_password",
    store_id: storeId,
    membership_id: membershipId,
    password,
  });
}
