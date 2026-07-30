/** Calendar-date helpers in the browser's own timezone.
 *
 * `new Date().toISOString().slice(0, 10)` is the tempting one-liner and it is
 * wrong here — it converts to UTC first, so anyone in Asia/Manila gets
 * yesterday's date for the first eight hours of every day. These build the
 * string from the local calendar fields instead, which is also what a
 * `<input type="date">` picker considers "today".
 */

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function todayISODate(): string {
  return toISODate(new Date())
}

/** The earliest date a form may accept when today itself is not allowed —
 * leave has to be filed in advance, and an offer's start date can't be a day
 * that's already underway. */
export function tomorrowISODate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return toISODate(d)
}
