export type CurrencyCode = 'PHP' | 'USD'

export const CURRENCY_SYMBOL: Record<CurrencyCode, string> = { PHP: '₱', USD: '$' }
export const CURRENCY_LABEL: Record<CurrencyCode, string> = {
  PHP: 'Philippine Peso (₱)',
  USD: 'US Dollar ($)',
}
const CURRENCY_LOCALE: Record<CurrencyCode, string> = { PHP: 'en-PH', USD: 'en-US' }

export function parseCurrencyCode(value: string | undefined): CurrencyCode {
  return value === 'USD' ? 'USD' : 'PHP'
}

/** Full currency-formatted display for read-only contexts (tables, summaries) — always 2 decimals. */
export function formatMoney(amount: number, currency: CurrencyCode): string {
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
