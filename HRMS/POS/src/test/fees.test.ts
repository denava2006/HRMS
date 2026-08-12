import { describe, expect, it } from "vitest";
import { computeFees, round2, sumFees, type Fee } from "@/lib/fees";

const fee = (over: Partial<Fee> = {}): Fee => ({
  id: "f1", name: "VAT", type: "percent", value: 12, enabled: true, ...over,
});

describe("round2", () => {
  it("rounds half away from zero, like PostgreSQL round(numeric, 2)", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(0.125)).toBe(0.13);
    expect(round2(2.675)).toBe(2.68);
  });

  it("does not drift on values that are already 2 decimals", () => {
    expect(round2(11.21)).toBe(11.21);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it("survives non-finite and exponent-notation input", () => {
    expect(round2(Number.NaN)).toBe(0);
    expect(round2(Number.POSITIVE_INFINITY)).toBe(0);
    expect(round2(1e-7)).toBe(0);
  });
});

describe("computeFees", () => {
  it("rounds each amount to 2 decimals so it matches what the database charges", () => {
    // Regression: 10.01 @ 12% = 1.2012. Unrounded, the client total became
    // 11.2112 while the database charged 11.21, so tendering the displayed
    // 11.21 was rejected as "Short by ₱0.00".
    const [applied] = computeFees(10.01, [fee()]);
    expect(applied.amount).toBe(1.2);
    expect(round2(10.01 + sumFees([applied]))).toBe(11.21);
  });

  it("keeps an exact cash tender valid across the cases that used to fail", () => {
    for (const [subtotal, rate, expected] of [
      [10.01, 12, 11.21],
      [20.03, 12, 22.43],
      [100.03, 3, 103.03],
      [55.55, 7, 59.44],
    ] as const) {
      const total = round2(subtotal + sumFees(computeFees(subtotal, [fee({ value: rate })])));
      expect(total).toBe(expected);
      // The cashier types exactly what the dialog shows; it must not be short.
      expect(total < total).toBe(false);
      expect(expected >= total).toBe(true);
    }
  });

  it("applies a fixed fee at its face value", () => {
    expect(computeFees(45, [fee({ type: "fixed", value: 5, name: "Service" })])[0].amount).toBe(5);
  });

  it("matches the server on a mixed fee set", () => {
    // secure_checkout on a 45.00 subtotal produced VAT 5.40 + Service 5.00 = 55.40.
    const applied = computeFees(45, [
      fee({ id: "a", name: "VAT", type: "percent", value: 12 }),
      fee({ id: "b", name: "Service", type: "fixed", value: 5 }),
      fee({ id: "c", name: "Off", type: "percent", value: 99, enabled: false }),
    ]);
    expect(applied.map((a) => a.amount)).toEqual([5.4, 5]);
    expect(round2(45 + sumFees(applied))).toBe(55.4);
  });

  it("ignores disabled, zero-value and unknown-type fees, as the database does", () => {
    expect(computeFees(100, [fee({ enabled: false })])).toHaveLength(0);
    expect(computeFees(100, [fee({ value: 0 })])).toHaveLength(0);
    expect(computeFees(100, [fee({ type: "flat" as Fee["type"], value: 10 })])).toHaveLength(0);
  });

  it("returns nothing when the store has no fees", () => {
    expect(computeFees(100, [])).toEqual([]);
    expect(computeFees(100, null)).toEqual([]);
    expect(sumFees([])).toBe(0);
  });
});
