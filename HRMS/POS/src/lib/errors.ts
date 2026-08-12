/**
 * Data-loading failures must never be presented as "no records".
 *
 * Pages show the friendly sentence from `userFacingError` and send the raw
 * error to the console only in development, so a cashier never sees SQL,
 * policy names or stack traces on the shop counter.
 */

const OFFLINE_HINT = "Cannot reach the local database. Check that Docker and Supabase are running.";
const DENIED_HINT = "You do not have permission to view this data.";

export function logTechnicalError(context: string, error: unknown): void {
  if (import.meta.env.DEV) {
    console.error(`[${context}]`, error);
  }
}

export function userFacingError(error: unknown, fallback = "Please try again in a moment."): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const message = raw.toLowerCase();

  if (!message) return fallback;
  if (/failed to fetch|network|econnrefused|fetch failed|timeout/.test(message)) return OFFLINE_HINT;
  if (/permission denied|row-level security|not authorized|jwt|access required|authentication required/.test(message)) {
    return DENIED_HINT;
  }
  return fallback;
}
