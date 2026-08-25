import { computeFees, round2, sumFees, type AppliedFee, type Fee } from '@/lib/posFees'

/**
 * The till's own arithmetic and cart rules.
 *
 * Everything here is a *preview*. `checkout_pos_sale` recomputes the price,
 * the fees, the total and the change from the database under lock, and its
 * answer is the one that is charged. This exists so the cashier sees the same
 * number a moment earlier, and so the till does not offer an action the
 * database would refuse.
 *
 * The rounding must match the server exactly. Each line rounds before anything
 * is summed, and each fee rounds before the fees are summed -- the same order
 * `checkout_pos_sale` uses. Diverge by a centavo and the till refuses an exact
 * cash tender with "Cash received is less than the total".
 */

export const PAYMENT_METHODS = ['cash', 'gcash', 'maya', 'bank', 'other'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Cash',
  gcash: 'GCash',
  maya: 'Maya',
  bank: 'Bank transfer',
  other: 'Other',
}

/** Mirrors public.pos_max_cart_lines() / pos_max_line_quantity(). */
export const MAX_CART_LINES = 50
export const MAX_LINE_QUANTITY = 999

export interface CatalogueProduct {
  product_id: string
  name: string
  category_name: string
  selling_price: number
  image_path: string | null
  available_quantity: number
  is_low_stock: boolean
}

export interface CartLine {
  product: CatalogueProduct
  quantity: number
}

export interface CartTotals {
  subtotal: number
  appliedFees: AppliedFee[]
  feesTotal: number
  total: number
  units: number
}

/**
 * Adds to the cart, merging a repeat tap into the existing line.
 *
 * The server normalises duplicates anyway, but merging here keeps the cart
 * readable and keeps the stock check meaningful -- two separate lines of the
 * same product would each look affordable while together exceeding stock.
 */
export function addToCart(cart: CartLine[], product: CatalogueProduct, quantity = 1): CartLine[] {
  const existing = cart.find((line) => line.product.product_id === product.product_id)
  if (!existing) {
    return [...cart, { product, quantity: Math.min(quantity, MAX_LINE_QUANTITY) }]
  }
  return cart.map((line) =>
    line.product.product_id === product.product_id
      ? { ...line, quantity: Math.min(line.quantity + quantity, MAX_LINE_QUANTITY) }
      : line
  )
}

export function setLineQuantity(cart: CartLine[], productId: string, quantity: number): CartLine[] {
  if (quantity <= 0) return cart.filter((line) => line.product.product_id !== productId)
  return cart.map((line) =>
    line.product.product_id === productId
      ? { ...line, quantity: Math.min(quantity, MAX_LINE_QUANTITY) }
      : line
  )
}

export function cartTotals(cart: CartLine[], fees: Fee[] | null | undefined): CartTotals {
  const subtotal = round2(
    cart.reduce((sum, line) => sum + round2(line.product.selling_price * line.quantity), 0)
  )
  const appliedFees = computeFees(subtotal, fees)
  const feesTotal = sumFees(appliedFees)
  return {
    subtotal,
    appliedFees,
    feesTotal,
    total: round2(subtotal + feesTotal),
    units: cart.reduce((sum, line) => sum + line.quantity, 0),
  }
}

export function changeDue(total: number, tendered: number): number {
  return round2(tendered - total)
}

/**
 * What the till sends. Only the safe inputs: which products, how many, and how
 * the customer is paying. No price, no total, no cashier id.
 */
export function cartToItems(cart: CartLine[]): { product_id: string; quantity: number }[] {
  return cart.map((line) => ({ product_id: line.product.product_id, quantity: line.quantity }))
}

export interface TillValidationInput {
  cart: CartLine[]
  method: PaymentMethod
  reference: string
  tendered: string
  total: number
}

/**
 * Mirrors the RPC's refusals so the cashier is told before the round trip.
 * The database still decides -- these checks are a courtesy, and the reference
 * formats in particular are re-validated server-side.
 */
export function validateSale(input: TillValidationInput): string[] {
  const errors: string[] = []
  const { cart, method, reference, tendered, total } = input

  if (cart.length === 0) errors.push('The cart is empty.')
  if (cart.length > MAX_CART_LINES) {
    errors.push(`A single sale can hold at most ${MAX_CART_LINES} different products.`)
  }

  for (const line of cart) {
    if (line.quantity > MAX_LINE_QUANTITY) {
      errors.push(`${line.product.name}: a single line cannot exceed ${MAX_LINE_QUANTITY} units.`)
    }
    if (line.quantity > line.product.available_quantity) {
      errors.push(
        `${line.product.name}: only ${line.product.available_quantity} left, ${line.quantity} in the cart.`
      )
    }
  }

  if (method === 'cash') {
    const amount = Number(tendered)
    if (tendered.trim() === '' || !Number.isFinite(amount)) {
      errors.push('Enter the cash received.')
    } else if (amount < total) {
      errors.push('Cash received is less than the total.')
    }
  } else {
    const trimmed = reference.trim()
    if (!trimmed) {
      errors.push(`A reference is required for ${PAYMENT_METHOD_LABEL[method]} payments.`)
    } else if ((method === 'gcash' || method === 'maya') && !/^[0-9]{6,32}$/.test(trimmed)) {
      errors.push(`A ${PAYMENT_METHOD_LABEL[method]} reference must be 6-32 digits.`)
    } else if (method === 'bank' && !/^[A-Za-z0-9 -]{6,64}$/.test(trimmed)) {
      errors.push('A bank reference must be 6-64 letters, numbers, spaces or hyphens.')
    } else if (method === 'other' && trimmed.length > 64) {
      errors.push('A reference must be 1-64 characters.')
    }
  }

  return errors
}

/* ------------------------------------------------------------ idempotency */

export interface CheckoutAttempt {
  fingerprint: string
  key: string
}

/**
 * A local description of the sale being attempted.
 *
 * This is NOT the fingerprint the database compares -- that one is computed
 * inside `checkout_pos_sale` with SHA-256 over the normalised request, because
 * a value the client supplies is a claim rather than a fact. This exists only
 * to decide when the till should mint a *new* key: the same sale keeps its key
 * so a retry is idempotent, and any change to the sale earns a fresh one.
 *
 * Items are normalised and sorted here for the same reason the server does it:
 * the same cart entered in a different order is the same sale.
 */
export function attemptFingerprint(input: {
  branchId: string | null
  items: { product_id: string; quantity: number }[]
  method: PaymentMethod
  reference: string | null
  tendered: number | null
}): string {
  const merged = new Map<string, number>()
  for (const item of input.items) {
    merged.set(item.product_id, (merged.get(item.product_id) ?? 0) + item.quantity)
  }
  const normalized = [...merged.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([product_id, quantity]) => ({ product_id, quantity }))

  return JSON.stringify({
    branch_id: input.branchId,
    items: normalized,
    method: input.method,
    reference: input.reference,
    tendered: input.tendered,
  })
}

/** Same sale as last time → reuse the key. Anything different → a new one. */
export function nextAttempt(
  previous: CheckoutAttempt | null,
  fingerprint: string,
  generateKey: () => string
): CheckoutAttempt {
  if (previous && previous.fingerprint === fingerprint) return previous
  return { fingerprint, key: generateKey() }
}

export function newCheckoutKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/* ------------------------------------------------------------------ errors */

export function describeCheckoutError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '')

  if (message.includes('already used for a different sale')) {
    return 'This till already recorded a different sale under that attempt. Start a new sale.'
  }
  if (message.includes('Stock for') && message.includes('changed during checkout')) {
    return 'Someone sold the last of an item while this sale was being rung up. Check the cart and try again.'
  }
  if (message.includes('Only') && message.includes('left')) {
    return message.replace(/^.*?ERROR:\s*/i, '')
  }
  if (message.includes('no longer available at this branch')) {
    return 'One of those products is no longer offered at this branch. Remove it and try again.'
  }
  if (message.includes('POS access at this branch')) {
    return 'You do not have POS access at this branch.'
  }
  if (message.includes('Cash received is less')) {
    return 'Cash received is less than the total.'
  }
  if (message.includes('reference')) {
    return message.replace(/^.*?ERROR:\s*/i, '')
  }
  return message || 'The sale could not be completed. Please try again.'
}

export const peso = (value: number) =>
  `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
