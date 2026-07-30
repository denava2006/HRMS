/** Validation for interview meeting links.
 *
 * The link an interviewer types is rendered as an `href` on the applicant's
 * tracking page, so anything that isn't a real absolute URL silently becomes a
 * dead link the applicant only discovers at interview time. Values like
 * "htts:12534gsdg" or a bare "meet.google.com" used to be accepted verbatim.
 */

/** Hosts must look like `something.tld` — a scheme plus a bare word ("https://meet")
 * parses fine but can't resolve for anyone outside the office network. */
const HOSTNAME_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i

export function isValidMeetingLink(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed || /\s/.test(trimmed)) return false

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return false
  }

  // http is tolerated so an internal meeting host still works; anything else
  // (mailto:, htts:, javascript:) is not a link an applicant can join.
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false

  return HOSTNAME_PATTERN.test(url.hostname)
}
