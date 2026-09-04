export type LifeMapNodeType = "direction" | "goal" | "milestone" | "project" | "week" | "plan_item";
export type LifeMapNodeStatus = "active" | "paused" | "completed" | "abandoned";

export interface LifeMapNode {
  id: string;
  userId: string;
  type: LifeMapNodeType;
  title: string;
  description?: string;
  status: LifeMapNodeStatus;
  parentId?: string;
  weight?: number;
  targetDate?: string;
  metadata?: Record<string, unknown>;
}

export interface LifeMapPath {
  nodeIds: string[];
  explanation: string[];
}

export interface NowStateCandidate {
  itemId: string;
  title: string;
  estimatedMinutes: number;
  priorityScore: number;
  availableNow: boolean;
  blocked?: boolean;
  protectedConflict?: boolean;
  lifeMapPath?: LifeMapPath;
  reasons?: string[];
}

export interface LivingAgendaNowState {
  generatedAt: string;
  current?: NowStateCandidate;
  next?: NowStateCandidate;
  alternatives: NowStateCandidate[];
  explanation: string[];
}
