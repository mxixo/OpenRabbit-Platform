import { describe, expect, it } from "vitest";
import { withRetry } from "../../src/core/with-retry.js";

describe("withRetry", () => {
  it("retries transient failures until success", async () => {
    let attempts = 0;
    const value = await withRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          throw new Error("temporary");
        }
        return "ok";
      },
      { maxAttempts: 3 }
    );
    expect(value).toBe("ok");
    expect(attempts).toBe(3);
  });

  it("stops retrying on non-retryable errors", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts += 1;
          throw new Error("fatal");
        },
        { maxAttempts: 3 },
        () => ({ code: "FATAL", message: "fatal", retryable: false })
      )
    ).rejects.toThrow("fatal");
    expect(attempts).toBe(1);
  });
});
