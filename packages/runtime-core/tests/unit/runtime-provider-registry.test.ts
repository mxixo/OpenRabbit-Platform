import { describe, expect, it } from "vitest";
import { InMemoryRuntimeProviderRegistry } from "../../src/core/in-memory-runtime-provider-registry.js";
import { MockRuntimeProvider } from "../../src/mocks/mock-runtime-provider.js";

describe("InMemoryRuntimeProviderRegistry", () => {
  it("registers providers and resolves preference order", () => {
    const registry = new InMemoryRuntimeProviderRegistry();
    const primary = new MockRuntimeProvider({ id: "openclaw", displayName: "OpenClaw" });
    const fallback = new MockRuntimeProvider({ id: "mock-runtime", displayName: "Mock" });

    registry.register(fallback);
    registry.register(primary);

    expect(registry.list()).toHaveLength(2);
    expect(registry.resolvePreference(["missing", "openclaw", "mock-runtime"]).id).toBe(
      "openclaw"
    );
    expect(registry.resolvePreference(["mock-runtime"]).id).toBe("mock-runtime");
  });

  it("throws when preference cannot be satisfied", () => {
    const registry = new InMemoryRuntimeProviderRegistry();
    registry.register(new MockRuntimeProvider({ id: "mock-runtime" }));

    expect(() => registry.resolvePreference(["openclaw"])).toThrow(
      "No registered runtime provider matched preference"
    );
    expect(() => registry.resolvePreference([])).toThrow("Runtime preference list is empty");
  });

  it("rejects duplicate provider ids", () => {
    const registry = new InMemoryRuntimeProviderRegistry();
    registry.register(new MockRuntimeProvider({ id: "mock-runtime" }));
    expect(() => registry.register(new MockRuntimeProvider({ id: "mock-runtime" }))).toThrow(
      "already registered"
    );
  });
});
