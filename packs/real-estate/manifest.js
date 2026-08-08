"use strict";

const manifest = {
  id: "pack.real-estate",
  version: "0.1.0",
  name: "Real Estate Pack",
  description:
    "Initial OpenRabbit industry pack for real-estate acquisition screening and research workflows.",
  capabilities: ["real-estate"],
  integrations: [],
  workerPresets: [
    {
      id: "acquisitions",
      role: "acquisitions_analyst",
      displayName: "Acquisitions Analyst",
      mission:
        "Screen and underwrite real-estate opportunities, surface assumptions and risks, and prepare decision-ready investment summaries.",
      runtimePreference: ["openclaw", "mock-runtime"],
      allowedCapabilities: ["real-estate"],
      allowedTools: ["deal.underwrite"],
      memoryScope: "org",
      approvalPolicy: {
        policyId: "real-estate-acquisitions-default",
        requiresApproval: true,
      },
      tags: ["pack:real-estate", "acquisitions"],
    },
    {
      id: "research",
      role: "research_analyst",
      displayName: "Research Analyst",
      mission:
        "Research markets, properties, and supporting context for real-estate investment decisions.",
      runtimePreference: ["openclaw", "mock-runtime"],
      allowedCapabilities: ["real-estate"],
      allowedTools: [],
      memoryScope: "worker",
      approvalPolicy: {
        policyId: "real-estate-research-default",
        requiresApproval: false,
      },
      tags: ["pack:real-estate", "research"],
    },
  ],
  workflowPresets: ["commercial-investment"],
  defaults: {
    primaryWorkerPreset: "acquisitions",
  },
  tags: ["vertical", "real-estate"],
  metadata: {
    optionalIntegrations: ["hubspot", "rentcast", "mls", "camino"],
  },
};

module.exports = manifest;
