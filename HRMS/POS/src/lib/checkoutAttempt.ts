import type { CartItem, PaymentMethod } from "@/lib/store";

/**
 * Checkout idempotency.
 *
 * `checkout_key` is what makes a retry safe: public.secure_checkout returns the
 * already-committed sale for the same (store, user, key) instead of charging
 * twice. So the key must stay THE SAME while the customer retries the same
 * sale, and must change as soon as anything about the sale changes.
 */
export type CheckoutAttempt = { fingerprint: string; key: string };

export type CheckoutAttemptInput = {
  storeId: string | null;
  items: { product_id: string; quantity: number }[];
  method: PaymentMethod;
  reference: string | null;
  amountTendered: number | null;
};

export function checkoutFingerprint(input: CheckoutAttemptInput): string {
  return JSON.stringify({
    store_id: input.storeId,
    items: input.items,
    method: input.method,
    reference: input.reference,
    amount_tendered: input.amountTendered,
  });
}

export function cartToCheckoutItems(cart: CartItem[]) {
  return cart.map((item) => ({ product_id: item.product.id, quantity: item.quantity }));
}

/**
 * Same sale as the previous attempt → reuse its key (the retry is idempotent).
 * Anything different, or no previous attempt → a fresh key.
 */
export function nextCheckoutAttempt(
  previous: CheckoutAttempt | null,
  fingerprint: string,
  generateKey: () => string
): CheckoutAttempt {
  if (previous && previous.fingerprint === fingerprint) return previous;
  return { fingerprint, key: generateKey() };
}
