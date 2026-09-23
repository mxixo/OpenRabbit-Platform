const SUPABASE_PROJECT_REF = /^[a-z0-9]{20}$/;

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function verifyProductionSupabaseBuildEnv(env = {}) {
  const projectUrl = clean(env.VITE_SUPABASE_URL);
  const publishableKey = clean(env.VITE_SUPABASE_ANON_KEY);
  const projectRef = clean(env.VITE_SUPABASE_PROJECT_REF).toLowerCase();
  const anyConfigured = Boolean(projectUrl || publishableKey || projectRef);

  if (!anyConfigured) {
    return Object.freeze({ configured: false });
  }

  if (!projectUrl || !publishableKey || !projectRef) {
    throw new Error(
      'production Supabase configuration must include VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and VITE_SUPABASE_PROJECT_REF together'
    );
  }

  if (!SUPABASE_PROJECT_REF.test(projectRef)) {
    throw new Error('VITE_SUPABASE_PROJECT_REF must be an explicit 20-character Supabase project ref');
  }

  let parsed;
  try {
    parsed = new URL(projectUrl);
  } catch {
    throw new Error('VITE_SUPABASE_URL must be a valid absolute URL');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('VITE_SUPABASE_URL must use https');
  }
  if (
    parsed.username ||
    parsed.password ||
    parsed.port ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error('VITE_SUPABASE_URL must be the canonical Supabase project origin');
  }

  const expectedHost = `${projectRef}.supabase.co`;
  if (parsed.hostname.toLowerCase() !== expectedHost) {
    throw new Error('VITE_SUPABASE_URL does not match the explicitly designated VITE_SUPABASE_PROJECT_REF');
  }

  return Object.freeze({
    configured: true,
    projectRef,
    projectUrl: `https://${expectedHost}`,
  });
}
