/** How long the company commits to taking on each side of the conversation.
 * One number, used by both the applicant-facing copy and the HR-facing
 * follow-up prompts, so the promise and the enforcement can't drift apart. */
export const RESPONSE_WINDOW_DAYS = 7

export function daysSince(isoDate: string): number {
  const then = new Date(isoDate).getTime()
  return Math.floor((Date.now() - then) / 86_400_000)
}

/** Working days left in the window, floored at 0 — for "we'll get back to you
 * within N days" style copy. */
export function daysRemaining(isoDate: string): number {
  return Math.max(0, RESPONSE_WINDOW_DAYS - daysSince(isoDate))
}

/** An applicant who hasn't answered their job offer within the window. HR can
 * close these out rather than leaving the requisition open indefinitely. */
export function isAwaitingResponseTooLong(isoDate: string): boolean {
  return daysSince(isoDate) >= RESPONSE_WINDOW_DAYS
}
