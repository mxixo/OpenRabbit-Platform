import { describe, expect, it } from "vitest";
import { InMemoryCapabilityCatalog } from "../../src/core/in-memory-capability-catalog.js";
import { InMemoryCapabilityManager } from "../../src/core/in-memory-capability-manager.js";
import type { CapabilityModuleManifest } from "../../src/interfaces/capability-module.js";

function crmManifest(): CapabilityModuleManifest {
  return {
    id: "crm",
    version: "1.0.0",
    name: "CRM",
    description: "Customer relationship management",
    tools: [{ name: "crm.list_contacts" }],
    integrations: ["hubspot"],
    tags: ["sales"]
  };
}

function realEstateManifest(): CapabilityModuleManifest {
  return {
    id: "real-estate",
    version: "0.1.0",
    name: "Real Estate",
    tools: [{ name: "deal.underwrite" }],
    workflows: [
      {
        id: "commercial-investment",
        name: "Commercial investment analysis",
        templateRef: "workflows/commercial-investment"
      }
    ],
    dependsOnCapabilities: ["crm"],
    tags: ["vertical"]
  };
}

describe("InMemoryCapabilityCatalog", () => {
  it("registers and filters capabilities", () => {
    const catalog = new InMemoryCapabilityCatalog();
    catalog.register(crmManifest());
    catalog.register(realEstateManifest());

    expect(catalog.list()).toHaveLength(2);
    expect(catalog.list({ tag: "vertical" }).map((m) => m.id)).toEqual([
      "real-estate"
    ]);
    expect(catalog.get("crm")?.tools?.[0]?.name).toBe("crm.list_contacts");
  });

  it("rejects invalid manifests and duplicates", () => {
    const catalog = new InMemoryCapabilityCatalog();
    expect(() =>
      catalog.register({ id: "", version: "1", name: "x" })
    ).toThrow("Capability id is required");

    catalog.register(crmManifest());
    expect(() => catalog.register(crmManifest())).toThrow("already registered");
  });
});

describe("InMemoryCapabilityManager", () => {
  it("installs, enables, disables, and lists org capabilities", () => {
    const catalog = new InMemoryCapabilityCatalog();
    catalog.register(crmManifest());
    const manager = new InMemoryCapabilityManager(catalog);

    const installed = manager.install({
      orgId: "org-1",
      capabilityId: "crm",
      enable: false
    });
    expect(installed.status).toBe("installed");
    expect(manager.isEnabled("org-1", "crm")).toBe(false);

    const enabled = manager.enable("org-1", "crm");
    expect(enabled.status).toBe("enabled");
    expect(manager.listEnabledCapabilityIds("org-1")).toEqual(["crm"]);

    const disabled = manager.disable("org-1", "crm");
    expect(disabled.status).toBe("disabled");
    expect(manager.listInstallations("org-1", { status: "disabled" })).toHaveLength(
      1
    );
  });

  it("enforces capability dependencies", () => {
    const catalog = new InMemoryCapabilityCatalog();
    catalog.register(crmManifest());
    catalog.register(realEstateManifest());
    const manager = new InMemoryCapabilityManager(catalog);

    expect(() =>
      manager.install({ orgId: "org-1", capabilityId: "real-estate" })
    ).toThrow("Missing capability dependencies");

    manager.install({ orgId: "org-1", capabilityId: "crm" });
    const re = manager.install({ orgId: "org-1", capabilityId: "real-estate" });
    expect(re.status).toBe("enabled");
    expect(manager.listEnabledCapabilityIds("org-1").sort()).toEqual([
      "crm",
      "real-estate"
    ]);
  });

  it("rejects unknown capabilities and version mismatches", () => {
    const catalog = new InMemoryCapabilityCatalog();
    catalog.register(crmManifest());
    const manager = new InMemoryCapabilityManager(catalog);

    expect(() =>
      manager.install({ orgId: "org-1", capabilityId: "missing" })
    ).toThrow("not found in catalog");

    expect(() =>
      manager.install({
        orgId: "org-1",
        capabilityId: "crm",
        version: "9.9.9"
      })
    ).toThrow("version mismatch");
  });
});
