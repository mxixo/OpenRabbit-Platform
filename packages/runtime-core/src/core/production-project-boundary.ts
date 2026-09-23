export type HostedDataProvider = "supabase";

export interface ProductionProjectBoundaryInput {
  product: "openrabbit";
  environment: "production";
  provider: HostedDataProvider;
  expectedProjectRef: string;
  projectUrl: string;
}

export interface VerifiedProductionProjectBoundary {
  product: "openrabbit";
  environment: "production";
  provider: HostedDataProvider;
  projectRef: string;
  projectUrl: string;
}

const SUPABASE_PROJECT_REF = /^[a-z0-9]{20}$/;

function requireProjectRef(value: string): string {
  const ref = value.trim().toLowerCase();
  if (!SUPABASE_PROJECT_REF.test(ref)) {
    throw new Error("production project ref must be an explicit 20-character Supabase project ref");
  }
  return ref;
}

export function verifyProductionProjectBoundary(
  input: ProductionProjectBoundaryInput,
): VerifiedProductionProjectBoundary {
  if (input.product !== "openrabbit" || input.environment !== "production") {
    throw new Error("production boundary must be explicitly scoped to openrabbit/production");
  }
  if (input.provider !== "supabase") {
    throw new Error("unsupported production data provider");
  }

  const expectedProjectRef = requireProjectRef(input.expectedProjectRef);
  let parsed: URL;
  try {
    parsed = new URL(input.projectUrl);
  } catch {
    throw new Error("production project URL must be a valid absolute URL");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("production project URL must use https");
  }
  if (parsed.username || parsed.password || parsed.port || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("production project URL must be the canonical Supabase project origin");
  }

  const expectedHost = `${expectedProjectRef}.supabase.co`;
  if (parsed.hostname.toLowerCase() !== expectedHost) {
    throw new Error("production project URL does not match the explicitly designated project ref");
  }

  return Object.freeze({
    product: "openrabbit" as const,
    environment: "production" as const,
    provider: "supabase" as const,
    projectRef: expectedProjectRef,
    projectUrl: `https://${expectedHost}`,
  });
}
