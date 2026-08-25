import { describe, it, expect } from "vitest";
import {
  getPaymentReferenceRule,
  requiresPaymentReference,
  sanitizePaymentReferenceInput,
  validatePaymentReference,
} from "@/lib/paymentValidation";

describe("validatePaymentReference", () => {
  it("accepts GCash and Maya references of 6 to 32 digits", () => {
    expect(validatePaymentReference("gcash", "123456")).toMatchObject({ valid: true, normalized: "123456" });
    expect(validatePaymentReference("gcash", "1".repeat(32))).toMatchObject({ valid: true });
    expect(validatePaymentReference("maya", "123456789012345678901234567890")).toMatchObject({
      valid: true,
      normalized: "123456789012345678901234567890",
    });
  });

  it("accepts bank references with letters, digits, spaces and hyphens", () => {
    expect(validatePaymentReference("bank", "BPI 1234-AB")).toMatchObject({ valid: true, normalized: "BPI 1234-AB" });
    expect(validatePaymentReference("bank", "A".repeat(64))).toMatchObject({ valid: true });
  });

  it("rejects empty, short, oversized and malformed references", () => {
    expect(validatePaymentReference("gcash", "")).toMatchObject({ valid: false });
    expect(validatePaymentReference("gcash", "   ")).toMatchObject({ valid: false });
    expect(validatePaymentReference("maya", "12345")).toMatchObject({ valid: false });
    expect(validatePaymentReference("gcash", "1".repeat(33))).toMatchObject({ valid: false });
    expect(validatePaymentReference("gcash", "12345a")).toMatchObject({ valid: false });
    expect(validatePaymentReference("bank", "bad@ref")).toMatchObject({ valid: false });
    expect(validatePaymentReference("bank", "AB-12")).toMatchObject({ valid: false });
    expect(validatePaymentReference("bank", "A".repeat(65))).toMatchObject({ valid: false });
  });

  it("always returns a message when invalid and none when valid", () => {
    expect(validatePaymentReference("gcash", "12").message).not.toBe("");
    expect(validatePaymentReference("gcash", "123456").message).toBe("");
  });

  it("reports the min and max length used by the counter", () => {
    expect(validatePaymentReference("gcash", "")).toMatchObject({ minLength: 6, maxLength: 32 });
    expect(validatePaymentReference("bank", "")).toMatchObject({ minLength: 6, maxLength: 64 });
  });

  it("trims surrounding whitespace before checkout", () => {
    const result = validatePaymentReference("bank", "  BPI 1234-AB  ");
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe("BPI 1234-AB");
  });

  it("leaves cash payments unaffected", () => {
    expect(requiresPaymentReference("cash")).toBe(false);
    expect(getPaymentReferenceRule("cash")).toBeNull();
    expect(validatePaymentReference("cash", "")).toMatchObject({ valid: true, normalized: "", message: "" });
    expect(validatePaymentReference("cash", "anything at all")).toMatchObject({ valid: true, normalized: "" });
  });
});

describe("sanitizePaymentReferenceInput", () => {
  it("restricts GCash and Maya input to digits and 32 characters", () => {
    expect(sanitizePaymentReferenceInput("gcash", "12ab34-56")).toBe("123456");
    expect(sanitizePaymentReferenceInput("maya", "9".repeat(40))).toHaveLength(32);
  });

  it("restricts bank input to letters, digits, spaces, hyphens and 64 characters", () => {
    expect(sanitizePaymentReferenceInput("bank", "BPI/1234@AB")).toBe("BPI1234AB");
    expect(sanitizePaymentReferenceInput("bank", "x".repeat(80))).toHaveLength(64);
  });

  it("keeps cash references empty", () => {
    expect(sanitizePaymentReferenceInput("cash", "123456")).toBe("");
  });
});
