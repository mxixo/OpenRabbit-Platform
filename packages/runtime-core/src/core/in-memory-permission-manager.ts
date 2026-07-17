import {
  PermissionDecision,
  PermissionManager,
  PermissionPolicy,
  PermissionRequest
} from "../interfaces/permissions.js";

const MATCH_ANY = "*";

export class InMemoryPermissionManager implements PermissionManager {
  private readonly policies: PermissionPolicy[] = [];

  addPolicy(policy: PermissionPolicy): void {
    if (this.policies.find((p) => p.id === policy.id)) {
      throw new Error(`Policy already exists: ${policy.id}`);
    }
    this.policies.push(policy);
  }

  evaluate(request: PermissionRequest): PermissionDecision {
    const matching = this.policies.filter((policy) => this.matches(policy, request));
    const explicitDeny = matching.find((policy) => policy.effect === "deny");
    if (explicitDeny) {
      return {
        allowed: false,
        reason: "Denied by policy",
        matchedPolicyId: explicitDeny.id
      };
    }

    const explicitAllow = matching.find((policy) => policy.effect === "allow");
    if (explicitAllow) {
      return {
        allowed: true,
        reason: "Allowed by policy",
        matchedPolicyId: explicitAllow.id
      };
    }

    return {
      allowed: false,
      reason: "No matching allow policy found"
    };
  }

  private matches(policy: PermissionPolicy, request: PermissionRequest): boolean {
    const actionMatch =
      policy.actions.includes(MATCH_ANY) || policy.actions.includes(request.action);
    const resourceMatch =
      policy.resources.includes(MATCH_ANY) || policy.resources.includes(request.resource.type);
    const subjectMatch =
      !policy.subjects ||
      policy.subjects.includes(MATCH_ANY) ||
      policy.subjects.includes(request.subject.id);
    const roleMatch =
      !policy.roles ||
      policy.roles.includes(MATCH_ANY) ||
      (request.subject.roles ?? []).some((role) => policy.roles?.includes(role));
    const conditionMatch = policy.condition ? policy.condition(request) : true;

    return actionMatch && resourceMatch && subjectMatch && roleMatch && conditionMatch;
  }
}
