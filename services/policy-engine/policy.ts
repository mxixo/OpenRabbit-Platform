export type RiskClass = "GREEN" | "YELLOW" | "RED" | "BLOCK";
export type AutonomyProfile = "seamless" | "review-important" | "strict";
export type TargetVerifier = "connector-gateway" | "browser-guard" | "broker-adapter" | "platform-runtime";

export interface TargetIdentity {
  orgId?: string;
  connectionId?: string;
  accountId?: string;
  resourceId?: string;
  domain?: string;
  environment?: string;
}

export interface TargetBinding {
  verifier: TargetVerifier;
  expected: TargetIdentity;
  observed: TargetIdentity;
  requiredDimensions?: string[];
  ambiguous?: boolean;
}

export interface TargetVerificationResult {
  valid: boolean;
  reason: string;
  mismatches: Array<{ dimension: string; reason: string }>;
}

export interface ActionRequest {
  orgId: string;
  userId: string;
  capability: string;
  operation: string;
  connectionId?: string;
  withinGrantedScope: boolean;
  externalSideEffect?: boolean;
  targetBinding?: TargetBinding;
  requestsNewPermission?: boolean;
  changesCredentialsOrSecurity?: boolean;
  destructiveBulkAction?: boolean;
  materialFinancialCommitment?: boolean;
  unusualButAuthorized?: boolean;
  attemptsBoundaryEscape?: boolean;
  attemptsSecretExposure?: boolean;
  attemptsAuditBypass?: boolean;
  crossTenant?: boolean;
}

export interface PolicyDecision {
  riskClass: RiskClass;
  execute: boolean;
  requireConfirmation: boolean;
  surface: boolean;
  reasons: string[];
  targetVerification?: TargetVerificationResult;
}

function normalized(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return String(value).trim();
}

export function validateTargetScope(a: ActionRequest): TargetVerificationResult {
  if (!a.externalSideEffect) return { valid: true, reason: "no-external-side-effect", mismatches: [] };
  if (!a.targetBinding) return { valid: false, reason: "missing-target-verifier", mismatches: [] };
  if (a.targetBinding.ambiguous) return { valid: false, reason: "ambiguous-target", mismatches: [] };

  const required = new Set(a.targetBinding.requiredDimensions ?? []);
  required.add("orgId");
  if (a.connectionId) required.add("connectionId");

  const mismatches: Array<{ dimension: string; reason: string }> = [];
  for (const dimension of required) {
    const expected = normalized(a.targetBinding.expected[dimension as keyof TargetIdentity]);
    const observed = normalized(a.targetBinding.observed[dimension as keyof TargetIdentity]);
    if (!expected || !observed) mismatches.push({ dimension, reason: "missing" });
    else if (expected !== observed) mismatches.push({ dimension, reason: "mismatch" });
  }

  if (normalized(a.targetBinding.expected.orgId) !== normalized(a.orgId)) {
    mismatches.push({ dimension: "orgId", reason: "request-binding-mismatch" });
  }
  if (a.connectionId && normalized(a.targetBinding.expected.connectionId) !== normalized(a.connectionId)) {
    mismatches.push({ dimension: "connectionId", reason: "request-binding-mismatch" });
  }

  return mismatches.length
    ? { valid: false, reason: "target-scope-mismatch", mismatches }
    : { valid: true, reason: "trusted-target-match", mismatches: [] };
}

export function evaluateAction(a: ActionRequest, profile: AutonomyProfile = "seamless"): PolicyDecision {
  const targetVerification = validateTargetScope(a);
  const hardBlock = a.attemptsBoundaryEscape || a.attemptsSecretExposure || a.attemptsAuditBypass || a.crossTenant || !a.withinGrantedScope || !targetVerification.valid;
  if (hardBlock) return { riskClass:"BLOCK", execute:false, requireConfirmation:false, surface:true, reasons:["hard-boundary", ...(targetVerification.valid ? [] : [targetVerification.reason])], targetVerification };

  const red = a.requestsNewPermission || a.changesCredentialsOrSecurity || a.destructiveBulkAction || a.materialFinancialCommitment;
  if (red) return { riskClass:"RED", execute:false, requireConfirmation:true, surface:true, reasons:["consequential-or-new-authority"], targetVerification };

  if (a.unusualButAuthorized) {
    const requireConfirmation = profile !== "seamless";
    return { riskClass:"YELLOW", execute:!requireConfirmation, requireConfirmation, surface:true, reasons:["unusual-authorized-action"], targetVerification };
  }

  const strict = profile === "strict";
  return { riskClass:"GREEN", execute:!strict, requireConfirmation:strict, surface:false, reasons:["standing-authority"], targetVerification };
}
