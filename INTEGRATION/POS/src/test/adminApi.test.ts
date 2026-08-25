import { describe, expect, it } from "vitest";
import { describeFunctionError, STAFF_SERVICE_UNAVAILABLE } from "@/lib/adminApi";

/**
 * supabase-js reports every non-2xx from an Edge Function as the same opaque
 * message and hides the real response on `error.context`. These tests pin the
 * unwrapping, because without it a permission refusal and a crashed container
 * are indistinguishable to the operator.
 */
const invokeError = (status: number, body: unknown, contentType = "application/json") =>
  Object.assign(new Error("Edge Function returned a non-2xx status code"), {
    context: new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "Content-Type": contentType },
    }),
  });

describe("describeFunctionError", () => {
  it("treats a 503 as the service being down, not a permission problem", async () => {
    // The exact failure seen when the edge runtime container is not running.
    const result = await describeFunctionError(invokeError(503, "", "text/plain"));
    expect(result.unavailable).toBe(true);
    expect(result.status).toBe(503);
    expect(result.message).toBe(STAFF_SERVICE_UNAVAILABLE);
    expect(result.message).toMatch(/npx supabase start/);
  });

  it.each([502, 504])("treats a %i gateway failure the same way", async (status) => {
    expect((await describeFunctionError(invokeError(status, ""))).unavailable).toBe(true);
  });

  it("treats a transport failure with no status as the service being down", async () => {
    const result = await describeFunctionError(new TypeError("Failed to fetch"));
    expect(result.unavailable).toBe(true);
    expect(result.status).toBeNull();
    expect(result.message).toBe(STAFF_SERVICE_UNAVAILABLE);
  });

  it("surfaces the function's own wording for a permission refusal", async () => {
    const result = await describeFunctionError(
      invokeError(403, { error: "Active Admin access is required." })
    );
    expect(result.message).toBe("Active Admin access is required.");
    expect(result.status).toBe(403);
    expect(result.unavailable).toBe(false);
  });

  it("surfaces the function's own wording for a rejected role escalation", async () => {
    const result = await describeFunctionError(
      invokeError(400, { error: "Only Manager or Cashier accounts can be created." })
    );
    expect(result.message).toBe("Only Manager or Cashier accounts can be created.");
    expect(result.unavailable).toBe(false);
  });

  it("falls back to a readable message when the body carries no error field", async () => {
    expect((await describeFunctionError(invokeError(401, {}))).message)
      .toBe("Your session has expired. Sign in again.");
    expect((await describeFunctionError(invokeError(403, {}))).message)
      .toBe("You do not have permission to manage staff.");
    expect((await describeFunctionError(invokeError(400, {}))).message)
      .toBe("The staff service rejected that request. Please try again.");
  });

  it("survives a non-JSON body instead of throwing", async () => {
    const result = await describeFunctionError(
      invokeError(500, "<html><body>Bad Gateway</body></html>", "text/html")
    );
    expect(result.status).toBe(500);
    expect(result.message).toBe("The staff service rejected that request. Please try again.");
  });

  it("never leaks a stack trace or internal detail into the message", async () => {
    const leaky = invokeError(500, {
      error: "boom",
      stack: "at requireStoreAdmin (file:///home/deno/functions/_shared/staff-auth.ts:57:9)",
    });
    const result = await describeFunctionError(leaky);
    expect(result.message).toBe("boom");
    expect(result.message).not.toMatch(/file:\/\/|staff-auth\.ts|at .+\(/);
  });

  it("reads GoTrue-style bodies that use msg instead of error", async () => {
    expect((await describeFunctionError(invokeError(401, { msg: "Missing authorization header" }))).message)
      .toBe("Missing authorization header");
  });
});
