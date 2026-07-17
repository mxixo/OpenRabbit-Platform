import { describe, expect, it } from "vitest";
import { isMcpRequestEnvelope } from "../../src/index.js";

describe("mcp contracts", () => {
  it("recognizes valid request envelopes", () => {
    expect(isMcpRequestEnvelope({ method: "tools/list" })).toBe(true);
    expect(isMcpRequestEnvelope({ method: "" })).toBe(false);
    expect(isMcpRequestEnvelope(null)).toBe(false);
  });
});
