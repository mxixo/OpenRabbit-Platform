import { describe, expect, it } from "vitest";
import {
  MCP_PROTOCOL_VERSION,
  isMcpProtocolVersion,
  isMcpRequestEnvelope,
  negotiateMcpProtocolVersion
} from "../../src/index.js";

describe("mcp contracts", () => {
  it("recognizes valid request envelopes", () => {
    expect(isMcpRequestEnvelope({ method: "tools/list" })).toBe(true);
    expect(isMcpRequestEnvelope({ method: "" })).toBe(false);
    expect(isMcpRequestEnvelope(null)).toBe(false);
  });

  it("validates and negotiates protocol versions", () => {
    expect(isMcpProtocolVersion(MCP_PROTOCOL_VERSION)).toBe(true);
    expect(isMcpProtocolVersion("2024-01-01")).toBe(false);
    expect(negotiateMcpProtocolVersion(MCP_PROTOCOL_VERSION)).toBe(MCP_PROTOCOL_VERSION);
    expect(negotiateMcpProtocolVersion("2024-01-01")).toBeUndefined();
  });
});
