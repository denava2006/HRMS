import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { canAccessPath } from "./navigation";
import type { Profile } from "./types";

/**
 * Loads the signed-in user's profile on the server. Returns null when there is
 * no session. Use `requireProfile` when the caller must be authenticated.
 */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*, department:departments!profiles_department_id_fkey(*)")
    .eq("id", user.id)
    .single();

  return (data as Profile) ?? null;
}

/** Same as getProfile but redirects to /login when there is no session. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

/**
 * Loads the profile and enforces the role rules declared in the navigation
 * model. Pages use this instead of hand-rolled role checks so that hiding a
 * sidebar link and blocking the route can never drift apart — a hidden link is
 * not access control, since the URL can still be typed.
 */
export async function requireAccess(pathname: string): Promise<Profile> {
  const profile = await requireProfile();
  if (!canAccessPath(profile.role, pathname)) redirect("/dashboard");
  return profile;
}
