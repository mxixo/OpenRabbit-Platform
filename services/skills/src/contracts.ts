import { ServiceReliabilitySnapshot } from "../../../packages/runtime-core/src/index.js";

export interface ServiceDescriptor {
  serviceName: "skills";
  version: string;
  capabilities: string[];
}

export interface ServiceHealth {
  status: "ok" | "degraded";
  timestamp: string;
  dependencies: Array<{ name: string; status: "up" | "down" }>;
}

export interface SkillDefinition {
  id: string;
  version: string;
  name: string;
  description: string;
  tags?: string[];
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface SkillExecutionRequest {
  skillId: string;
  args?: Record<string, unknown>;
}

export interface SkillExecutionResult {
  ok: boolean;
  output?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

export type SkillRuntimeHandler = (args?: Record<string, unknown>) => unknown | Promise<unknown>;

export interface SkillsService {
  start(): Promise<void>;
  stop(): Promise<void>;
  isStarted(): boolean;
  getDescriptor(): ServiceDescriptor;
  getHealth(): ServiceHealth;
  getReliabilitySnapshot(): ServiceReliabilitySnapshot;
  registerSkill(definition: SkillDefinition, handler: SkillRuntimeHandler): Promise<{ registered: boolean; reason?: string }>;
  unregisterSkill(skillId: string): Promise<{ removed: boolean; reason?: string }>;
  listSkills(): Promise<SkillDefinition[]>;
  executeSkill(request: SkillExecutionRequest): Promise<SkillExecutionResult>;
}
