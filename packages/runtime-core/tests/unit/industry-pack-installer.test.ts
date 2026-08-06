import { describe, expect, it } from "vitest";
import { InMemoryCapabilityCatalog } from "../../src/core/in-memory-capability-catalog.js";
import { InMemoryCapabilityManager } from "../../src/core/in-memory-capability-manager.js";
import { InMemoryIndustryPackCatalog } from "../../src/core/in-memory-industry-pack-catalog.js";
import { InMemoryIndustryPackInstaller } from "../../src/core/in-memory-industry-pack-installer.js";
import { InMemoryIntegrationAdapterRegistry } from "../../src/core/in-memory-integration-adapter-registry.js";
import { InMemoryWorkerRegistry } from "../../src/core/in-memory-worker-registry.js";
import type { IndustryPackManifest } from "../../src/interfaces/industry-pack.js";
import type { IntegrationAdapter } from "../../src/interfaces/integration-adapter.js";
import type { CapabilityModuleManifest } from "../../src/interfaces/capability-module.js";

function stubAdapter(id: string, kind: "mcp" | "rest" | "oauth" = "rest"): IntegrationAdapter {
  return {
    id,
    kind,
    displayName: id,
    async connect() {
      return {
        id: `${id}-handle`,
        adapterId: id,
        kind,
        connectedAt: new Date().toISOString()
      };
    },
    async health() {
      return {
        status: "up",
        checkedAt: new Date().toISOString()
      };
    },
    async disconnect() {
      return;
    }
  };
}

function seedCapabilities(catalog: InMemoryCapabilityCatalog): void {
  const modules: CapabilityModuleManifest[] = [
    {
      id: "crm",
      version: "1.0.0",
      name: "CRM",
      tools: [{ name: "crm.list_contacts" }]
    },
    {
      id: "real-estate",
      version: "0.1.0",
      name: "Real Estate",
      tools: [{ name: "deal.underwrite" }],
      dependsOnCapabilities: ["crm"]
    },
    {
      id: "knowledge",
      version: "1.0.0",
      name: "Knowledge"
    }
  ];
  for (const manifest of modules) {
    catalog.register(manifest);
  }
}

function realEstatePack(): IndustryPackManifest {
  return {
    id: "pack.real-estate",
    version: "0.1.0",
    name: "Real Estate Pack",
    capabilities: ["crm", "real-estate", "knowledge"],
    integrations: ["hubspot", "rentcast"],
    workerPresets: [
      {
        id: "acquisitions",
        role: "acquisitions_analyst",
        displayName: "Acquisitions Analyst",
        mission: "Source and underwrite deals",
        runtimePreference: ["openclaw", "mock-runtime"],
        allowedCapabilities: ["real-estate"],
        allowedTools: ["deal.underwrite"],
        memoryScope: "org",
        approvalPolicy: { policyId: "acq-approvals", requiresApproval: true },
        tags: ["pack:real-estate"]
      },
      {
        id: "research",
        role: "research_analyst",
        displayName: "Research Analyst",
        mission: "Market research",
        runtimePreference: ["mock-runtime"],
        allowedCapabilities: ["knowledge"],
        allowedTools: [],
        memoryScope: "worker",
        approvalPolicy: { policyId: "research-default" }
      }
    ],
    workflowPresets: ["commercial-investment"],
    tags: ["vertical", "real-estate"]
  };
}

describe("InMemoryIndustryPackInstaller", () => {
  it("installs pack capabilities, validates integrations, and materializes workers", () => {
    const capabilityCatalog = new InMemoryCapabilityCatalog();
    seedCapabilities(capabilityCatalog);
    const capabilities = new InMemoryCapabilityManager(capabilityCatalog);

    const packs = new InMemoryIndustryPackCatalog();
    packs.register(realEstatePack());

    const integrations = new InMemoryIntegrationAdapterRegistry();
    integrations.register(stubAdapter("hubspot", "oauth"));
    integrations.register(stubAdapter("rentcast", "rest"));

    const workers = new InMemoryWorkerRegistry();
    const installer = new InMemoryIndustryPackInstaller({
      packs,
      capabilities,
      integrations,
      workers
    });

    const result = installer.install({
      orgId: "org-42",
      packId: "pack.real-estate",
      materializeWorkers: true
    });

    expect(result.installation.status).toBe("enabled");
    expect(result.installation.installedCapabilityIds.sort()).toEqual([
      "crm",
      "knowledge",
      "real-estate"
    ]);
    expect(capabilities.listEnabledCapabilityIds("org-42").sort()).toEqual([
      "crm",
      "knowledge",
      "real-estate"
    ]);
    expect(result.workers).toHaveLength(2);
    expect(result.installation.createdWorkerIds).toHaveLength(2);

    const acq = workers
      .list({ orgId: "org-42", role: "acquisitions_analyst" })
      .at(0);
    expect(acq?.allowedCapabilities.sort()).toEqual([
      "crm",
      "knowledge",
      "real-estate"
    ]);
    expect(acq?.allowedTools).toEqual(["deal.underwrite"]);
    expect(installer.isEnabled("org-42", "pack.real-estate")).toBe(true);
  });

  it("fails when required integration adapters are missing", () => {
    const capabilityCatalog = new InMemoryCapabilityCatalog();
    seedCapabilities(capabilityCatalog);
    const capabilities = new InMemoryCapabilityManager(capabilityCatalog);
    const packs = new InMemoryIndustryPackCatalog();
    packs.register(realEstatePack());
    const integrations = new InMemoryIntegrationAdapterRegistry();
    integrations.register(stubAdapter("hubspot"));

    const installer = new InMemoryIndustryPackInstaller({
      packs,
      capabilities,
      integrations
    });

    expect(() =>
      installer.install({ orgId: "org-1", packId: "pack.real-estate" })
    ).toThrow("Missing integration adapters");
  });

  it("disables pack capabilities and uninstalls created workers", () => {
    const capabilityCatalog = new InMemoryCapabilityCatalog();
    seedCapabilities(capabilityCatalog);
    const capabilities = new InMemoryCapabilityManager(capabilityCatalog);
    const packs = new InMemoryIndustryPackCatalog();
    packs.register(realEstatePack());
    const integrations = new InMemoryIntegrationAdapterRegistry();
    integrations.register(stubAdapter("hubspot"));
    integrations.register(stubAdapter("rentcast"));
    const workers = new InMemoryWorkerRegistry();

    const installer = new InMemoryIndustryPackInstaller({
      packs,
      capabilities,
      integrations,
      workers
    });

    installer.install({
      orgId: "org-7",
      packId: "pack.real-estate",
      materializeWorkers: true
    });
    expect(workers.list({ orgId: "org-7" })).toHaveLength(2);

    const disabled = installer.disable("org-7", "pack.real-estate");
    expect(disabled.status).toBe("disabled");
    expect(capabilities.listEnabledCapabilityIds("org-7")).toHaveLength(0);

    installer.uninstall("org-7", "pack.real-estate");
    expect(installer.getInstallation("org-7", "pack.real-estate")).toBeUndefined();
    expect(workers.list({ orgId: "org-7" })).toHaveLength(0);
    // Shared capabilities remain installed for potential reuse.
    expect(capabilities.getInstallation("org-7", "crm")?.status).toBe("disabled");
  });

  it("requires worker registry when materializing workers", () => {
    const capabilityCatalog = new InMemoryCapabilityCatalog();
    seedCapabilities(capabilityCatalog);
    const capabilities = new InMemoryCapabilityManager(capabilityCatalog);
    const packs = new InMemoryIndustryPackCatalog();
    packs.register(realEstatePack());

    const installer = new InMemoryIndustryPackInstaller({
      packs,
      capabilities
    });

    expect(() =>
      installer.install({
        orgId: "org-1",
        packId: "pack.real-estate",
        materializeWorkers: true
      })
    ).toThrow("Worker registry is required");
  });
});
