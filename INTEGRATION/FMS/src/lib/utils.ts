import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names, resolving Tailwind conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as Philippine Peso currency. */
export function formatCurrency(value: number | null | undefined): string {
  const n = typeof value === "number" ? value : 0;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Compact peso formatting for tight spaces, e.g. ₱1.2M. */
export function formatCompactCurrency(value: number | null | undefined): string {
  const n = typeof value === "number" ? value : 0;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

/** Human-friendly date, e.g. "Jul 26, 2026". */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

/** Relative time, e.g. "2 days ago". */
export function timeAgo(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, secs] of units) {
    if (Math.abs(seconds) >= secs) {
      return rtf.format(-Math.round(seconds / secs), unit);
    }
  }
  return "just now";
}

/**
 * Keep only digits and a single decimal point (max 2 places) in a money input.
 * Blocks letters and symbols like "+", "-", "e" — typed or pasted.
 */
export function sanitizeAmount(raw: string): string {
  let v = raw.replace(/[^0-9.]/g, "");
  const firstDot = v.indexOf(".");
  if (firstDot !== -1) {
    // keep the first dot, drop any others
    v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
    const [int, dec] = v.split(".");
    v = int + "." + dec.slice(0, 2);
  }
  return v;
}

// -----------------------------------------------------------------------------
// Field sanitizers. Each strips characters as they are typed or pasted; the
// matching Server Action validates the same rules, since a client-side filter
// is a convenience, never a guarantee.
// -----------------------------------------------------------------------------

/** A person's name: letters, spaces and simple punctuation. No digits. */
export function sanitizePersonName(raw: string): string {
  return raw.replace(/[^\p{L}\s.'-]/gu, "").replace(/\s{2,}/g, " ");
}

/** A business name: letters and digits ("3M", "7-Eleven") but no stray symbols. */
export function sanitizeCompanyName(raw: string): string {
  return raw.replace(/[^\p{L}\p{N}\s.,&'()/-]/gu, "").replace(/\s{2,}/g, " ");
}

/** Digits only — used for the TIN. */
export function sanitizeDigits(raw: string, max = 12): string {
  return raw.replace(/\D/g, "").slice(0, max);
}

/** A phone number: digits, with an optional leading "+" for the country code. */
export function sanitizePhone(raw: string): string {
  const plus = raw.trimStart().startsWith("+");
  return (plus ? "+" : "") + raw.replace(/\D/g, "").slice(0, 15);
}

/** Display a TIN in the usual grouped form, e.g. 123-456-789-000. */
export function formatTin(tin: string | null | undefined): string {
  if (!tin) return "—";
  const digits = tin.replace(/\D/g, "");
  if (digits.length < 9) return tin;
  return digits.replace(/(\d{3})(?=\d)/g, "$1-");
}

/** True when the value holds at least one letter — catches "+++" style input. */
export function hasLetter(value: string): boolean {
  return /\p{L}/u.test(value);
}

export interface NormalizedField {
  value: string | null;
  error?: string;
}

/**
 * Contact number stored as digits with an optional leading "+". Spaces, dashes
 * and parentheses are accepted and stripped, so a number saved earlier as
 * "+63 2 8555 0100" still validates; letters are what get rejected.
 */
export function normalizeContactNumber(raw: string): NormalizedField {
  const trimmed = raw.trim();
  if (!trimmed) return { value: null };
  if (/[^\d\s+().-]/.test(trimmed)) {
    return { value: null, error: "The contact number may only contain digits." };
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    return { value: null, error: "Enter a contact number between 7 and 15 digits." };
  }
  return { value: (trimmed.startsWith("+") ? "+" : "") + digits };
}

/** TIN stored as bare digits; "345-678-901-000" is accepted and regrouped later. */
export function normalizeTin(raw: string): NormalizedField {
  const trimmed = raw.trim();
  if (!trimmed) return { value: null };
  if (/[^\d\s-]/.test(trimmed)) {
    return { value: null, error: "The TIN may only contain digits." };
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 12) {
    return { value: null, error: "A TIN is 9 to 12 digits." };
  }
  return { value: digits };
}

/** Initials from a full name, e.g. "John Rivera" -> "JR". */
export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
