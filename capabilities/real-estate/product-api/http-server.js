"use strict";

const crypto = require("crypto");
const http = require("http");

function required(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeCredential(input, index = 0) {
  if (!input || typeof input !== "object") throw new Error(`credential ${index + 1} is required`);
  const token = required(input.token, `credential ${index + 1} token`);
  if (Buffer.byteLength(token) < 32) throw new Error(`credential ${index + 1} token must be at least 32 bytes`);
  return {
    digest: digest(token),
    principal: {
      actorId: required(input.actorId, `credential ${index + 1} actorId`),
      orgId: required(input.orgId, `credential ${index + 1} orgId`),
    },
  };
}

function createTokenSetAuthenticator(credentials) {
  if (!Array.isArray(credentials) || !credentials.length) throw new Error("at least one credential is required");
  const principalsByDigest = new Map();
  credentials.map(normalizeCredential).forEach(({ digest: tokenDigest, principal }) => {
    if (principalsByDigest.has(tokenDigest)) throw new Error("duplicate credential token");
    principalsByDigest.set(tokenDigest, Object.freeze({ ...principal }));
  });
  return async function authenticate(request) {
    const authorization = request.headers.authorization || "";
    const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    if (!supplied) return undefined;
    return principalsByDigest.get(digest(supplied));
  };
}

function createStaticTokenAuthenticator({ token, actorId, orgId }) {
  return createTokenSetAuthenticator([{ token, actorId, orgId }]);
}

function orgFromPath(path) {
  const match = path.split("?")[0].match(/^\/v1\/orgs\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

function sendJson(response, status, payload) {
  const content = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(content),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(content);
}

function readJson(request, maxBodyBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        reject(Object.assign(new Error("Request body is too large"), { status: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(Object.assign(new Error("Request body must be valid JSON"), { status: 400 }));
      }
    });
    request.on("error", reject);
  });
}

function createRealEstateHttpServer({ api, authenticate, maxBodyBytes = 1024 * 1024 }) {
  if (!api || typeof api.handle !== "function") throw new Error("api.handle is required");
  if (typeof authenticate !== "function") throw new Error("authenticate is required");
  return http.createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      return sendJson(response, 200, { status: "ok" });
    }
    try {
      const principal = await authenticate(request);
      if (!principal) {
        response.setHeader("WWW-Authenticate", "Bearer");
        return sendJson(response, 401, { error: { code: "UNAUTHORIZED", message: "Authentication required" } });
      }
      const requestedOrg = orgFromPath(request.url || "");
      if (!requestedOrg || requestedOrg !== principal.orgId) {
        return sendJson(response, 403, { error: { code: "TENANT_FORBIDDEN", message: "Organization access denied" } });
      }
      const body = await readJson(request, maxBodyBytes);
      const result = await api.handle({
        method: request.method,
        path: request.url,
        body,
        actorId: principal.actorId,
      });
      return sendJson(response, result.status, result.error ? { error: result.error } : { data: result.data });
    } catch (error) {
      const status = Number(error?.status) || 500;
      return sendJson(response, status, {
        error: {
          code: status === 500 ? "INTERNAL_ERROR" : "INVALID_REQUEST",
          message: status === 500 ? "Request failed" : error.message,
        },
      });
    }
  });
}

module.exports = {
  normalizeCredential,
  createTokenSetAuthenticator,
  createStaticTokenAuthenticator,
  createRealEstateHttpServer,
};
