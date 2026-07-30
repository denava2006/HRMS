import type { Tables } from '@/lib/database.types'

/** Whether this account is still on the password HR handed over, and must
 * choose its own before being allowed anywhere.
 *
 * `activated_at` is null from account creation until the password actually
 * changes — the stamp is written by a trigger on auth.users, so it reflects a
 * real password change rather than a page claiming one happened. HR resetting a
 * password clears it again.
 *
 * Employees only. HR and Administrator logins are created by an administrator
 * who hands the credentials over directly, and gating them the same way would
 * lock the first administrator out of a fresh install.
 */
export function needsPasswordSetup(profile: Pick<Tables<'profiles'>, 'role' | 'activated_at'> | null): boolean {
  if (!profile) return false
  return profile.role === 'employee' && !profile.activated_at
}
