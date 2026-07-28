function isTruthy(value) {
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

function requireEnv(envName) {
  const value = process.env[envName];
  if (!isTruthy(value)) {
    throw new Error(`Missing required environment variable: ${envName}`);
  }
  return value;
}

function hasEnv(envName) {
  return isTruthy(process.env[envName]);
}

module.exports = {
  requireEnv,
  hasEnv,
};
