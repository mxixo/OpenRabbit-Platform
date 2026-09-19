export type RiskClass = "GREEN" | "YELLOW" | "RED" | "BLOCK";
export type AutonomyProfile = "seamless" | "review-important" | "strict";

export interface ActionRequest {
  orgId: string;
  userId: string;
  capability: string;
  operation: string;
  connectionId?: string;
  withinGrantedScope: boolean;
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
}

export function evaluateAction(a: ActionRequest, profile: AutonomyProfile = "seamless"): PolicyDecision {
  const hardBlock = a.attemptsBoundaryEscape || a.attemptsSecretExposure || a.attemptsAuditBypass || a.crossTenant || !a.withinGrantedScope;
  if (hardBlock) return { riskClass:"BLOCK", execute:false, requireConfirmation:false, surface:true, reasons:["hard-boundary"] };

  const red = a.requestsNewPermission || a.changesCredentialsOrSecurity || a.destructiveBulkAction || a.materialFinancialCommitment;
  if (red) return { riskClass:"RED", execute:false, requireConfirmation:true, surface:true, reasons:["consequential-or-new-authority"] };

  if (a.unusualButAuthorized) {
    const requireConfirmation = profile !== "seamless";
    return { riskClass:"YELLOW", execute:!requireConfirmation, requireConfirmation, surface:true, reasons:["unusual-authorized-action"] };
  }

  const strict = profile === "strict";
  return { riskClass:"GREEN", execute:!strict, requireConfirmation:strict, surface:false, reasons:["standing-authority"] };
}
