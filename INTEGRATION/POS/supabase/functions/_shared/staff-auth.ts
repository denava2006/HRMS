import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.105.1";

const allowedOrigins = new Set([
  "http://localhost:8080",
  "http://127.0.0.1:8080",
]);

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  return {
    "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "http://localhost:8080",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  return !origin || allowedOrigins.has(origin);
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

export function normalizeEmail(value: unknown): string {
  const email = String(value ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error("Enter a valid email address.");
  }
  return email;
}

export function validatePassword(value: unknown): string {
  const password = String(value ?? "");
  if (
    password.length < 8 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    throw new Error("Password must be at least 8 characters with uppercase, lowercase, number, and symbol.");
  }
  return password;
}

type AdminContext = {
  admin: SupabaseClient;
  caller: User;
};

export async function requireStoreAdmin(req: Request, storeId: unknown): Promise<AdminContext> {
  if (!isAllowedOrigin(req)) throw new Error("Origin is not allowed.");
  const id = String(storeId ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("A valid store is required.");
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) throw new Error("Local Supabase service is not configured.");

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Authentication required.");

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error("Authentication required.");

  const { data: membership, error: membershipError } = await admin
    .from("store_memberships")
    .select("id")
    .eq("store_id", id)
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .eq("status", "active")
    .maybeSingle();

  if (membershipError || !membership) throw new Error("Active Admin access is required.");
  return { admin, caller: data.user };
}

export function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Request failed.";
  if (/already.*registered|already.*exists|duplicate/i.test(message)) {
    return "An account with that email already exists.";
  }
  return message.replace(/SUPABASE_SERVICE_ROLE_KEY|service[_ -]?role/gi, "server credential");
}
