/** The system runs in pesos. Currency used to be selectable per job offer,
 * per employee, and system-wide, which meant three places could disagree about
 * what a number on a payslip meant — and nothing ever converted between them.
 * The `currency` columns stay so historical rows keep their label, but there
 * is no longer anything to pick.
 *
 * Kept as a type rather than inlined so the columns that carry it stay
 * self-describing, and so widening it later is a change in one file. */
export type CurrencyCode = 'PHP'

export const DEFAULT_CURRENCY: CurrencyCode = 'PHP'

export const CURRENCY_SYMBOL: Record<CurrencyCode, string> = { PHP: '₱' }
const CURRENCY_LOCALE: Record<CurrencyCode, string> = { PHP: 'en-PH' }

/** Anything stored before the system settled on one currency still reads back
 * as pesos — there is no conversion, and no second currency to fall back to. */
export function parseCurrencyCode(_value?: string): CurrencyCode {
  return DEFAULT_CURRENCY
}

/** Full currency-formatted display for read-only contexts (tables, summaries) — always 2 decimals. */
export function formatMoney(amount: number, currency: CurrencyCode = DEFAULT_CURRENCY): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/** Strips everything but digits and a single decimal point, capped at 2 decimal places. */
export function sanitizeMoneyInput(raw: string): string {
  const digitsAndDot = raw.replace(/[^0-9.]/g, '')
  const firstDot = digitsAndDot.indexOf('.')
  if (firstDot === -1) return digitsAndDot
  const wholePart = digitsAndDot.slice(0, firstDot)
  const fractionPart = digitsAndDot.slice(firstDot + 1).replace(/\./g, '').slice(0, 2)
  return `${wholePart}.${fractionPart}`
}

/** Thousands-grouped display of a raw numeric string, preserving whatever decimal
 * portion (if any) has been typed so far — e.g. "100000" -> "100,000", "999999.9" -> "999,999.9". */
export function formatGroupedAmount(raw: string): string {
  if (!raw) return raw
  const [wholePart, fractionPart] = raw.split('.')
  const grouped = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fractionPart !== undefined ? `${grouped}.${fractionPart}` : grouped
}
