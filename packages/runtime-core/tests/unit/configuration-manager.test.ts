import { describe, expect, it } from "vitest";
import { InMemoryConfigurationManager } from "../../src/core/in-memory-configuration-manager.js";

describe("InMemoryConfigurationManager", () => {
  it("resolves values with precedence and override support", () => {
    const config = new InMemoryConfigurationManager({
      defaults: { region: "us-east-1", retries: 1 }
    });

    config.addLayer({
      name: "env",
      precedence: 10,
      values: { retries: 3 }
    });
    config.set("region", "eu-west-1");

    expect(config.get("region")).toBe("eu-west-1");
    expect(config.get("retries")).toBe(3);
    expect(config.get("missing", "fallback")).toBe("fallback");
  });

  it("enforces required keys and validator constraints", () => {
    const config = new InMemoryConfigurationManager({
      validator: (key, value) => {
        if (key === "timeoutMs" && typeof value !== "number") {
          throw new Error("timeoutMs must be a number");
        }
      }
    });

    expect(() => config.getRequired("timeoutMs")).toThrow("Missing required configuration key");
    expect(() => config.set("timeoutMs", "bad")).toThrow("timeoutMs must be a number");
  });
});
