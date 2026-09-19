export type PolicyClass = "GREEN" | "YELLOW" | "RED" | "BLOCK";
export type AutonomyProfile = "seamless" | "review-important" | "strict";
export interface ActionRequest { organizationId:string; userId:string; capability:string; operation:string; connectionId?:string; resource?:string; hasStandingPermission:boolean; requestsNewPermission?:boolean; changesCredentialsOrSecurity?:boolean; destructiveBulk?:boolean; materialFinancialCommitment?:boolean; boundaryViolation?:boolean; exposesSecrets?:boolean; bypassesPolicyOrAudit?:boolean; unusual?:boolean; }
export interface PolicyDecision { policyClass:PolicyClass; execute:boolean; requiresApproval:boolean; surface:boolean; reason:string; }
export function decideAction(request:ActionRequest, profile:AutonomyProfile="seamless"):PolicyDecision {
 if(request.boundaryViolation||request.exposesSecrets||request.bypassesPolicyOrAudit) return {policyClass:"BLOCK",execute:false,requiresApproval:false,surface:true,reason:"Hard platform boundary"};
 if(!request.hasStandingPermission||request.requestsNewPermission||request.changesCredentialsOrSecurity||request.destructiveBulk||request.materialFinancialCommitment) return {policyClass:"RED",execute:false,requiresApproval:true,surface:true,reason:"Outside routine delegated authority"};
 if(request.unusual){ if(profile==="seamless") return {policyClass:"YELLOW",execute:true,requiresApproval:false,surface:true,reason:"Authorized unusual action"}; return {policyClass:"YELLOW",execute:false,requiresApproval:true,surface:true,reason:"Profile requires review of unusual action"}; }
 if(profile==="strict") return {policyClass:"GREEN",execute:false,requiresApproval:true,surface:true,reason:"Strict profile review"};
 return {policyClass:"GREEN",execute:true,requiresApproval:false,surface:false,reason:"Routine authorized action"};
}