export type FeeType = "percent" | "fixed";

export type Fee = {
  id: string;
  name: string;
  type: FeeType;
  value: number;
  enabled: boolean;
};

export type AppliedFee = { name: string; type: FeeType; value: number; amount: number };

/**
 * Rounds to 2 decimals the way PostgreSQL's `round(numeric, 2)` does: half away
 * from zero, applied to the decimal value rather than its binary approximation.
 * Scaling through a string is what keeps 1.005 at 1.01 instead of dropping to
 * 1.00, which is what `Math.round(1.005 * 100) / 100` returns.
 */
export const round2 = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  const scaled = Number(`${value}e2`);
  // Very small or very large magnitudes stringify in exponent notation, which
  // the trick above cannot parse. Those never round to anything but 0 or
  // themselves, so plain arithmetic is safe there.
  if (!Number.isFinite(scaled)) return Math.round(value * 100) / 100;
  const rounded = scaled < 0 ? -Math.round(-scaled) : Math.round(scaled);
  return Number(`${rounded}e-2`);
};

/**
 * Mirrors the fee arithmetic in `public.secure_checkout`: a fee applies only
 * when it is enabled, has a positive value, and carries a known type, and each
 * amount is rounded to 2 decimals BEFORE anything is added up.
 *
 * The database is the authority on what is actually charged. If this disagrees
 * with it by even a fraction of a centavo, the till refuses an exact cash
 * tender with "Short by ₱0.00", because the displayed total is rounded but the
 * comparison was not.
 */
export const computeFees = (subtotal: number, fees: Fee[] | null | undefined): AppliedFee[] => {
  if (!fees || fees.length === 0) return [];
  return fees
    .filter((f) => f.enabled && Number(f.value) > 0 && (f.type === "percent" || f.type === "fixed"))
    .map((f) => ({
      name: f.name,
      type: f.type,
      value: Number(f.value),
      amount: round2(f.type === "percent" ? (subtotal * Number(f.value)) / 100 : Number(f.value)),
    }));
};

export const sumFees = (applied: AppliedFee[]) => round2(applied.reduce((s, a) => s + a.amount, 0));

export const newFeeId = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2));
