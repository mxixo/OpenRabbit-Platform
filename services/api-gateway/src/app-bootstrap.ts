import type { ApiRequestEnvelope } from "./contracts.js";

export type OrganizationRole = "owner" | "admin" | "member" | "viewer";

export interface AppUser {
  id: string;
  displayName: string;
  email?: string;
}

export interface OrganizationMembership {
  orgId: string;
  orgName: string;
  role: OrganizationRole;
  permissions: string[];
}

export interface AppBootstrap {
  user: AppUser;
  activeOrganization: OrganizationMembership;
  organizations: OrganizationMembership[];
  environment: {
    product: "openrabbit";
    industryPack: "real-estate";
    workspacePath: string;
  };
}

function membershipKey(userId: string, orgId: string): string { return `${userId}:${orgId}`; }

/**
 * Development identity/membership store. Production authentication is expected
 * to authenticate the request before the API gateway and populate actorId.
 * This store owns authorization context, not passwords or login credentials.
 */
export class InMemoryAppIdentityStore {
  private readonly users = new Map<string, AppUser>();
  private readonly memberships = new Map<string, OrganizationMembership>();

  upsertUser(user: AppUser): void {
    if (!user.id.trim() || !user.displayName.trim()) throw new Error("user id and displayName are required");
    this.users.set(user.id, { ...user, id: user.id.trim(), displayName: user.displayName.trim(), email: user.email?.trim() });
  }

  addMembership(userId: string, membership: OrganizationMembership): void {
    if (!this.users.has(userId)) throw new Error(`Unknown user: ${userId}`);
    const permissions = [...new Set(membership.permissions.map((value) => value.trim()).filter(Boolean))];
    this.memberships.set(membershipKey(userId, membership.orgId), { ...membership, permissions });
  }

  getUser(userId: string): AppUser | undefined { return this.users.get(userId); }

  listMemberships(userId: string): OrganizationMembership[] {
    return [...this.memberships.entries()]
      .filter(([key]) => key.startsWith(`${userId}:`))
      .map(([, membership]) => membership);
  }

  bootstrap(request: ApiRequestEnvelope, requestedOrgId?: string): AppBootstrap {
    const actorId = request.actorId?.trim();
    if (!actorId || actorId === "anonymous") throw new Error("AUTHENTICATION_REQUIRED");
    const user = this.getUser(actorId);
    if (!user) throw new Error("UNKNOWN_ACTOR");
    const organizations = this.listMemberships(actorId);
    if (!organizations.length) throw new Error("NO_ORGANIZATION_MEMBERSHIP");
    const activeOrganization = requestedOrgId
      ? organizations.find((membership) => membership.orgId === requestedOrgId)
      : organizations[0];
    if (!activeOrganization) throw new Error("ORGANIZATION_ACCESS_DENIED");
    return {
      user,
      activeOrganization,
      organizations,
      environment: {
        product: "openrabbit",
        industryPack: "real-estate",
        workspacePath: `/workspace.html?org=${encodeURIComponent(activeOrganization.orgId)}`
      }
    };
  }
}
