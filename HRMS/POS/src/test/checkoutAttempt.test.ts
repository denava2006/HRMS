import { describe, it, expect, vi } from "vitest";
import {
  checkoutFingerprint,
  nextCheckoutAttempt,
  type CheckoutAttempt,
  type CheckoutAttemptInput,
} from "@/lib/checkoutAttempt";

const base: CheckoutAttemptInput = {
  storeId: "store-a",
  items: [{ product_id: "p1", quantity: 2 }],
  method: "cash",
  reference: null,
  amountTendered: 200,
};

const keyGen = () => {
  let counter = 0;
  return vi.fn(() => `key-${++counter}`);
};

describe("checkout idempotency", () => {
  it("reuses the same checkout key when the failed sale is retried unchanged", () => {
    const generate = keyGen();
    const fingerprint = checkoutFingerprint(base);

    const first = nextCheckoutAttempt(null, fingerprint, generate);
    const retry = nextCheckoutAttempt(first, fingerprint, generate);

    expect(retry.key).toBe(first.key);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("issues a new key when the cart changes", () => {
    const generate = keyGen();
    const first = nextCheckoutAttempt(null, checkoutFingerprint(base), generate);
    const changed = nextCheckoutAttempt(
      first,
      checkoutFingerprint({ ...base, items: [{ product_id: "p1", quantity: 3 }] }),
      generate
    );
    expect(changed.key).not.toBe(first.key);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("issues a new key when the payment method, reference or tender changes", () => {
    const generate = keyGen();
    const first = nextCheckoutAttempt(null, checkoutFingerprint(base), generate);

    const method = nextCheckoutAttempt(first, checkoutFingerprint({ ...base, method: "gcash", reference: "123456", amountTendered: null }), generate);
    expect(method.key).not.toBe(first.key);

    const reference = nextCheckoutAttempt(method, checkoutFingerprint({ ...base, method: "gcash", reference: "654321", amountTendered: null }), generate);
    expect(reference.key).not.toBe(method.key);

    const tender = nextCheckoutAttempt(first, checkoutFingerprint({ ...base, amountTendered: 500 }), generate);
    expect(tender.key).not.toBe(first.key);
  });

  it("issues a new key for a different store", () => {
    const generate = keyGen();
    const first = nextCheckoutAttempt(null, checkoutFingerprint(base), generate);
    const other = nextCheckoutAttempt(first, checkoutFingerprint({ ...base, storeId: "store-b" }), generate);
    expect(other.key).not.toBe(first.key);
  });

  it("starts a fresh key for the next sale after a successful checkout clears the attempt", () => {
    const generate = keyGen();
    const fingerprint = checkoutFingerprint(base);
    const first = nextCheckoutAttempt(null, fingerprint, generate);

    // POS clears checkoutAttemptRef once the sale is committed.
    const cleared: CheckoutAttempt | null = null;
    const nextSale = nextCheckoutAttempt(cleared, fingerprint, generate);

    expect(nextSale.key).not.toBe(first.key);
  });

  it("ignores whitespace-only differences because references are trimmed first", () => {
    const generate = keyGen();
    const trimmed = { ...base, method: "gcash" as const, reference: "123456", amountTendered: null };
    const first = nextCheckoutAttempt(null, checkoutFingerprint(trimmed), generate);
    const same = nextCheckoutAttempt(first, checkoutFingerprint({ ...trimmed, reference: "123456" }), generate);
    expect(same.key).toBe(first.key);
  });
});
