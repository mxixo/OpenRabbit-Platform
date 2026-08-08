import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  CapabilityModuleManifest,
  IndustryPackManifest,
  InMemoryCapabilityCatalog,
  InMemoryCapabilityManager,
  InMemoryIndustryPackCatalog,
  InMemoryIndustryPackInstaller,
  InMemoryRuntimeProviderRegistry,
  InMemoryWorkerOrchestrator,
  InMemoryWorkerRegistry,
  RuntimeProvider,
  ToolRef,
  WorkerDefinition,
  WorkerTaskRequest,
  WorkerTaskResult
} from "@openrabbit/runtime-core";
import type { OrchestratorService } from "./contracts.js";
import { createOrchestratorService } from "./service.js";

const require = createRequire(import.meta.url);
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../../..");

interface SkillRunner {
  run(skillName: string, input: unknown): Promise<unknown>;
}

interface OpenClawRuntimeModule {
  OpenClawRuntimeProvider: new (options: { executor: unknown }) => RuntimeProvider;
  SkillRunnerOpenClawExecutor: new (runner: SkillRunner) => unknown;
}

interface SkillModule {
  createSkillRunner(context?: Record<string, unknown>): SkillRunner;
}

export interface RealEstateBootstrap {
  orgId: string;
  service: OrchestratorService;
  acquisitionsWorker: WorkerDefinition;
  researchWorker?: WorkerDefinition;
  runUnderwriting(
    input: Omit<WorkerTaskRequest, "workerId" | "taskType">
  ): Promise<WorkerTaskResult>;
}

function loadCapabilityManifest(): CapabilityModuleManifest {
  return require(
    path.join(repoRoot, "capabilities/real-estate/manifest.js")
  ) as CapabilityModuleManifest;
}

function loadPackManifest(): IndustryPackManifest {
  return require(path.join(repoRoot, "packs/real-estate/manifest.js")) as IndustryPackManifest;
}

function loadOpenClawRuntime(): OpenClawRuntimeModule {
  return require(path.join(repoRoot, "runtimes/openclaw")) as OpenClawRuntimeModule;
}

function loadSkillModule(): SkillModule {
  return require(path.join(repoRoot, "src/skills")) as SkillModule;
}

function resolveCapabilityTools(
  manifest: CapabilityModuleManifest,
  allowedNames: readonly string[]
): ToolRef[] {
  const allowed = new Set(allowedNames);
  return (manifest.tools ?? [])
    .filter((tool) => allowed.has(tool.name))
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      tags: tool.tags ? [...tool.tags] : undefined
    }));
}

/**
 * Composes the first executable OpenRabbit vertical loop:
 * Real Estate Pack -> materialized workers -> WorkerOrchestrator -> OpenClaw
 * RuntimeProvider -> existing skill execution compatibility transport.
 */
export async function bootstrapRealEstateOrg(
  orgId: string
): Promise<RealEstateBootstrap> {
  if (!orgId?.trim()) {
    throw new Error("orgId is required");
  }

  const capabilityManifest = loadCapabilityManifest();
  const packManifest = loadPackManifest();

  const capabilityCatalog = new InMemoryCapabilityCatalog();
  capabilityCatalog.register(capabilityManifest);
  const capabilityManager = new InMemoryCapabilityManager(capabilityCatalog);

  const packCatalog = new InMemoryIndustryPackCatalog();
  packCatalog.register(packManifest);

  const workers = new InMemoryWorkerRegistry();
  const packInstaller = new InMemoryIndustryPackInstaller({
    packs: packCatalog,
    capabilities: capabilityManager,
    workers
  });

  const installation = packInstaller.install({
    orgId,
    packId: packManifest.id,
    materializeWorkers: true,
    workerIdPrefix: "real-estate"
  });

  const acquisitionsWorker = installation.workers?.find(
    (worker) => worker.role === "acquisitions_analyst"
  );
  if (!acquisitionsWorker) {
    throw new Error("Real Estate Pack did not materialize an Acquisitions Analyst");
  }
  const researchWorker = installation.workers?.find(
    (worker) => worker.role === "research_analyst"
  );

  const { createSkillRunner } = loadSkillModule();
  const { OpenClawRuntimeProvider, SkillRunnerOpenClawExecutor } =
    loadOpenClawRuntime();
  const skillRunner = createSkillRunner({
    actor: "platform",
    orgId,
    packId: packManifest.id
  });
  const executor = new SkillRunnerOpenClawExecutor(skillRunner);
  const openClawProvider = new OpenClawRuntimeProvider({ executor });

  const runtimes = new InMemoryRuntimeProviderRegistry();
  runtimes.register(openClawProvider);

  const workerOrchestrator = new InMemoryWorkerOrchestrator({
    workers,
    runtimes,
    resolveTools: (names) => resolveCapabilityTools(capabilityManifest, names)
  });

  const service = createOrchestratorService();
  service.registerWorkerOrchestrator(workerOrchestrator);
  await service.start();

  return {
    orgId,
    service,
    acquisitionsWorker,
    researchWorker,
    runUnderwriting(input) {
      return service.runWorkerTask({
        ...input,
        workerId: acquisitionsWorker.id,
        taskType: "commercial_investment_workflow"
      });
    }
  };
}
