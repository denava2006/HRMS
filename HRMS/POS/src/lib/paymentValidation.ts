import type { PaymentMethod } from "@/lib/store";

/**
 * Payment-reference rules. These mirror `private.validate_payment_reference`
 * in supabase/migrations/20260801010000_payment_reference_and_audit_clarity.sql
 * so the browser and the database agree on what a valid reference looks like.
 * The database is the authority — this copy only gives faster feedback.
 */
export type PaymentReferenceRule = {
  minLength: number;
  maxLength: number;
  pattern: RegExp;
  /** Matches the characters the input silently drops while typing. */
  strip: RegExp;
  inputMode: "numeric" | "text";
  placeholder: string;
  hint: string;
  message: string;
};

export type PaymentReferenceValidation = {
  valid: boolean;
  /** Trimmed value that is safe to send to checkout. */
  normalized: string;
  minLength: number;
  maxLength: number;
  /** Empty when the reference is valid or when none is required. */
  message: string;
};

const NUMERIC_RULE = {
  minLength: 6,
  maxLength: 32,
  pattern: /^[0-9]{6,32}$/,
  strip: /[^0-9]/g,
  inputMode: "numeric" as const,
  placeholder: "e.g. 1234567890",
};

export const PAYMENT_REFERENCE_RULES: Partial<Record<PaymentMethod, PaymentReferenceRule>> = {
  gcash: {
    ...NUMERIC_RULE,
    hint: "6–32 digits, numbers only.",
    message: "GCash reference must be 6–32 digits (numbers only).",
  },
  maya: {
    ...NUMERIC_RULE,
    hint: "6–32 digits, numbers only.",
    message: "Maya reference must be 6–32 digits (numbers only).",
  },
  bank: {
    minLength: 6,
    maxLength: 64,
    pattern: /^[A-Za-z0-9 -]{6,64}$/,
    strip: /[^A-Za-z0-9 -]/g,
    inputMode: "text",
    placeholder: "e.g. BPI 1234-AB",
    hint: "6–64 characters: letters, numbers, spaces and hyphens.",
    message: "Bank reference must be 6–64 characters using letters, numbers, spaces or hyphens.",
  },
  // The POS payment picker never offers "other", but the database accepts it,
  // so the rule is mirrored here. Non-printable characters are stripped, which
  // matches the database rejecting control characters.
  other: {
    minLength: 1,
    maxLength: 64,
    pattern: /^[\x20-\x7E]{1,64}$/,
    strip: /[^\x20-\x7E]/g,
    inputMode: "text",
    placeholder: "Reference",
    hint: "Up to 64 printable characters.",
    message: "A payment reference of up to 64 printable characters is required.",
  },
};

/** Cash sales never carry a reference; every other method requires one. */
export function requiresPaymentReference(method: PaymentMethod): boolean {
  return method !== "cash";
}

export function getPaymentReferenceRule(method: PaymentMethod): PaymentReferenceRule | null {
  return PAYMENT_REFERENCE_RULES[method] ?? null;
}

/**
 * Method-specific input restriction: drops characters the method never allows
 * and caps the length, so the field cannot hold an unsubmittable value.
 */
export function sanitizePaymentReferenceInput(method: PaymentMethod, raw: string): string {
  const rule = getPaymentReferenceRule(method);
  if (!rule) return "";
  return raw.replace(rule.strip, "").slice(0, rule.maxLength);
}

export function validatePaymentReference(method: PaymentMethod, value: string): PaymentReferenceValidation {
  if (!requiresPaymentReference(method)) {
    return { valid: true, normalized: "", minLength: 0, maxLength: 0, message: "" };
  }

  const rule = getPaymentReferenceRule(method);
  const normalized = (value ?? "").trim();
  if (!rule) {
    // Unknown method: still require something rather than silently accepting.
    return {
      valid: normalized.length > 0,
      normalized,
      minLength: 1,
      maxLength: 64,
      message: normalized.length > 0 ? "" : "Reference number is required for online payments.",
    };
  }

  const valid = rule.pattern.test(normalized);
  return {
    valid,
    normalized,
    minLength: rule.minLength,
    maxLength: rule.maxLength,
    message: valid
      ? ""
      : normalized.length === 0
        ? "Reference number is required for online payments."
        : normalized.length < rule.minLength
          ? `Reference is too short — ${rule.message}`
          : rule.message,
  };
}
