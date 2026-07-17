import { describe, expect, it } from "vitest";
import { MockModelProvider } from "../../src/mocks/mock-model-provider.js";

describe("MockModelProvider", () => {
  it("invokes registered model responders", async () => {
    const provider = new MockModelProvider();
    provider.registerModel(
      "mock-sonnet",
      async (request) => ({
        model: request.model,
        output: `response:${request.input}`
      }),
      { supportsStreaming: true, supportsToolUse: true }
    );

    const result = await provider.invoke({ model: "mock-sonnet", input: "hello" });
    expect(result.output).toBe("response:hello");
    expect(provider.getCapabilities("mock-sonnet").supportsToolUse).toBe(true);
  });

  it("fails when model responder is missing", async () => {
    const provider = new MockModelProvider();
    await expect(provider.invoke({ model: "missing", input: "x" })).rejects.toThrow(
      "No mock responder configured"
    );
  });
});
