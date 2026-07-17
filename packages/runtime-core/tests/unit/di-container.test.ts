import { describe, expect, it } from "vitest";
import { SimpleDIContainer } from "../../src/core/simple-di-container.js";

describe("SimpleDIContainer", () => {
  it("resolves singleton dependencies deterministically", () => {
    const container = new SimpleDIContainer();
    const LOGGER = Symbol("logger");
    const SERVICE = Symbol("service");

    container.registerValue(LOGGER, { name: "log" });
    container.register({
      token: SERVICE,
      lifetime: "singleton",
      dependencies: [LOGGER],
      factory: (logger) => ({ logger })
    });

    const first = container.resolve<{ logger: { name: string } }>(SERVICE);
    const second = container.resolve<{ logger: { name: string } }>(SERVICE);

    expect(first).toBe(second);
    expect(first.logger.name).toBe("log");
  });

  it("rejects missing registrations", () => {
    const container = new SimpleDIContainer();
    expect(() => container.resolve(Symbol("missing"))).toThrow("No service registered");
  });
});
