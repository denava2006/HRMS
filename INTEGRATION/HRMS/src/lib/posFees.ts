/**
 * Additional-fee configuration for a branch's till.
 *
 * Ported from the standalone POS's `src/lib/fees.ts` with its arithmetic
 * unchanged, and paired with a validator that mirrors the database's
 * `public.pos_fees_are_valid`.
 *
 * WHAT THIS IS NOT: the authority on what a customer is charged. That belongs
 * to the checkout RPC, which is a later phase and has not been ported. The
 * arithmetic lives here now for two reasons only -- so the settings screen can
 * preview what a configured fee would add, and so the rounding behaviour is
 * pinned by tests before anything depends on it.
 *
 * The rounding is worth preserving exactly. The POS's own note records why: if
 * the client and the database disagree by a fraction of a centavo, the till
 * refuses an exact cash tender with "Short by PHP 0.00", because the displayed
 * total was rounded and the comparison was not.
 */

export const FEE_TYPES = ['fixed', 'percent'] as const
export type FeeType = (typeof FEE_TYPES)[number]

export interface Fee {
  id: string
  name: string
  type: FeeType
  value: number
  enabled: boolean
}

export interface AppliedFee {
  name: string
  type: FeeType
  value: number
  amount: number
}

export const FEE_TYPE_LABEL: Record<FeeType, string> = {
  fixed: 'Fixed amount',
  percent: 'Percentage',
}

/** Matches the database's cap in pos_fees_are_valid. */
export const MAX_FEES = 20
export const MAX_FEE_NAME_LENGTH = 80

/**
 * Rounds to 2 decimals the way PostgreSQL's `round(numeric, 2)` does: half away
 * from zero, applied to the decimal value rather than its binary
 * approximation. Scaling through a string is what keeps 1.005 at 1.01 instead
 * of dropping to 1.00, which is what `Math.round(1.005 * 100) / 100` returns.
 */
export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0
  const scaled = Number(`${value}e2`)
  // Very small or very large magnitudes stringify in exponent notation, which
  // the trick above cannot parse. Those never round to anything but 0 or
  // themselves, so plain arithmetic is safe there.
  if (!Number.isFinite(scaled)) return Math.round(value * 100) / 100
  const rounded = scaled < 0 ? -Math.round(-scaled) : Math.round(scaled)
  return Number(`${rounded}e-2`)
}

/**
 * What the configured fees would add to a subtotal.
 *
 * A fee applies only when it is enabled, has a positive value, and carries a
 * known type, and each amount is rounded to 2 decimals BEFORE anything is added
 * up -- rounding the sum instead would drift from the database by a centavo on
 * some baskets.
 */
export function computeFees(subtotal: number, fees: Fee[] | null | undefined): AppliedFee[] {
  if (!fees || fees.length === 0) return []
  return fees
    .filter((fee) => fee.enabled && Number(fee.value) > 0 && FEE_TYPES.includes(fee.type))
    .map((fee) => ({
      name: fee.name,
      type: fee.type,
      value: Number(fee.value),
      amount: round2(
        fee.type === 'percent' ? (subtotal * Number(fee.value)) / 100 : Number(fee.value)
      ),
    }))
}

export function sumFees(applied: AppliedFee[]): number {
  return round2(applied.reduce((total, fee) => total + fee.amount, 0))
}

export function newFeeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

/**
 * Reads whatever came back from the `fees` jsonb column.
 *
 * A branch with no settings row, or a row written before a rule tightened,
 * must render as "no fees" rather than throwing -- the POS portal cannot crash
 * because a branch was never configured.
 */
export function parseFees(raw: unknown): Fee[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isFee)
}

function isFee(value: unknown): value is Fee {
  if (typeof value !== 'object' || value === null) return false
  const fee = value as Record<string, unknown>
  return (
    typeof fee.id === 'string' &&
    typeof fee.name === 'string' &&
    typeof fee.value === 'number' &&
    typeof fee.enabled === 'boolean' &&
    FEE_TYPES.includes(fee.type as FeeType)
  )
}

/**
 * The same rules as `public.pos_fees_are_valid`, checked before the round trip
 * so the editor can point at the offending row instead of surfacing a
 * constraint name.
 *
 * The database remains the authority: this returning no errors is not what
 * makes a save safe, the CHECK constraint is.
 */
export function validateFees(fees: Fee[]): string[] {
  const errors: string[] = []

  if (fees.length > MAX_FEES) {
    errors.push(`A branch can have at most ${MAX_FEES} fees.`)
  }

  const seenNames = new Set<string>()
  for (const fee of fees) {
    const label = fee.name.trim() || 'Unnamed fee'

    if (!fee.id.trim()) errors.push(`${label} is missing an internal id.`)
    if (!fee.name.trim()) errors.push('Every fee needs a name.')
    if (fee.name.length > MAX_FEE_NAME_LENGTH) {
      errors.push(`${label}: a name cannot be longer than ${MAX_FEE_NAME_LENGTH} characters.`)
    }
    if (!FEE_TYPES.includes(fee.type)) errors.push(`${label}: unsupported fee type.`)
    if (!Number.isFinite(fee.value)) errors.push(`${label}: the value must be a number.`)
    else if (fee.value < 0) errors.push(`${label}: a fee cannot be negative.`)
    else if (fee.type === 'percent' && fee.value > 100) {
      errors.push(`${label}: a percentage fee cannot exceed 100%.`)
    }

    // Not a database rule -- two fees called "Service Charge" are valid JSON but
    // unreadable on a receipt.
    const key = fee.name.trim().toLowerCase()
    if (key && seenNames.has(key)) errors.push(`${label} is listed more than once.`)
    if (key) seenNames.add(key)
  }

  return errors
}

/** The storage path for a branch's payment QR: `<branch_id>/<uuid>.<ext>`.
 * The database CHECK requires the first segment to be the branch's own id. */
export function paymentQrPath(branchId: string, fileName: string): string {
  // `'noextension'.split('.').pop()` returns the whole name, not an empty
  // string, so a dotless filename would otherwise become the "extension" and
  // land in the object path verbatim. Only text after a real dot counts.
  const lastDot = fileName.lastIndexOf('.')
  const rawExtension = lastDot > -1 ? fileName.slice(lastDot + 1) : ''
  const extension = rawExtension.replace(/[^a-z0-9]/gi, '').slice(0, 10).toLowerCase() || 'png'
  return `${branchId}/${newFeeId()}.${extension}`
}
