"use strict";

const crypto = require("crypto");
const http = require("http");

function required(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

function digest(value) {
  return crypto.createHash("sha256").update(value).digest();
}

function createStaticTokenAuthenticator({ token, actorId, orgId }) {
  const normalizedToken = required(token, "token");
  if (Buffer.byteLength(normalizedToken) < 32) throw new Error("token must be at least 32 bytes");
  const expected = digest(normalizedToken);
  const principal = { actorId: required(actorId, "actorId"), orgId: required(orgId, "orgId") };
  return async function authenticate(request) {
    const authorization = request.headers.authorization || "";
    const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    if (!supplied || !crypto.timingSafeEqual(digest(supplied), expected)) return undefined;
    return principal;
  };
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

module.exports = { createStaticTokenAuthenticator, createRealEstateHttpServer };
