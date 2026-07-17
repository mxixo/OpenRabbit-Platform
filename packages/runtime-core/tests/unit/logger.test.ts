import { describe, expect, it } from "vitest";
import { InMemoryLogSink } from "../../src/core/in-memory-log-sink.js";
import { StructuredLogger } from "../../src/core/structured-logger.js";

describe("StructuredLogger", () => {
  it("writes structured entries to sinks", async () => {
    const sink = new InMemoryLogSink();
    const logger = new StructuredLogger([sink], "debug").child({ service: "runtime" });

    await logger.info("hello", { requestId: "r1" });

    const entries = sink.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.context?.service).toBe("runtime");
    expect(entries[0]?.fields?.requestId).toBe("r1");
  });

  it("respects minimum level", async () => {
    const sink = new InMemoryLogSink();
    const logger = new StructuredLogger([sink], "warn");
    await logger.info("skip");
    await logger.error("keep");
    expect(sink.getEntries()).toHaveLength(1);
    expect(sink.getEntries()[0]?.level).toBe("error");
  });
});
