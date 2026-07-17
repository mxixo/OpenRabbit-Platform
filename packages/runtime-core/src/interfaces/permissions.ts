export interface PermissionSubject {
  id: string;
  roles?: string[];
  attributes?: Record<string, unknown>;
}

export interface PermissionResource {
  type: string;
  id?: string;
  attributes?: Record<string, unknown>;
}

export interface PermissionRequest {
  subject: PermissionSubject;
  action: string;
  resource: PermissionResource;
}

export type PermissionEffect = "allow" | "deny";

export interface PermissionPolicy {
  id: string;
  effect: PermissionEffect;
  actions: string[];
  resources: string[];
  subjects?: string[];
  roles?: string[];
  condition?: (request: PermissionRequest) => boolean;
}

export interface PermissionDecision {
  allowed: boolean;
  reason: string;
  matchedPolicyId?: string;
}

export interface PermissionManager {
  addPolicy(policy: PermissionPolicy): void;
  evaluate(request: PermissionRequest): PermissionDecision;
}
