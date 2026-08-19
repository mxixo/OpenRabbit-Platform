"use strict";

require("dotenv").config();
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { ConnectionRegistry } = require("../integrations/connection-registry");
const { GmailOAuthAdapter } = require("../integrations/google/gmail-oauth");

const PORT = Number(process.env.OPENRABBIT_PROTOTYPE_PORT || 8787);
const APP_ORIGIN = process.env.OPENRABBIT_APP_ORIGIN || `http://localhost:${PORT}`;
const USER_ID = process.env.OPENRABBIT_PROTOTYPE_USER_ID || "prototype-user";
const STATIC_ROOT = path.resolve(__dirname, "../clients/openrabbit-command-center");

const registry = new ConnectionRegistry({});
const gmail = new GmailOAuthAdapter({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI || `${APP_ORIGIN}/api/integrations/gmail/callback`,
  registry,
});

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type":"application/json; charset=utf-8", "content-length":Buffer.byteLength(payload) });
  res.end(payload);
}
function redirect(res, location) { res.writeHead(302, { location }); res.end(); }
function safeAppPath(pathname) { return (!pathname || !pathname.startsWith("/") || pathname.startsWith("//")) ? "/communications.html" : pathname; }
function contentType(file) { return ({ ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8", ".svg":"image/svg+xml" })[path.extname(file)] || "application/octet-stream"; }
function serveStatic(urlPath, res) {
  const requested = urlPath === "/" ? "/index.html" : urlPath;
  const file = path.resolve(STATIC_ROOT, `.${requested}`);
  if (!file.startsWith(`${STATIC_ROOT}${path.sep}`)) return false;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  const data = fs.readFileSync(file);
  res.writeHead(200, { "content-type":contentType(file), "content-length":data.length, "cache-control":"no-store" });
  res.end(data);
  return true;
}

async function activeGmailConnection() {
  let connection = await registry.findProviderConnection({ userId:USER_ID, provider:"gmail" });
  if (!connection) return null;
  if (connection.expiresAt && connection.expiresAt <= Date.now() + 60_000 && connection.refreshToken) {
    const refreshed = await gmail.refresh(connection.refreshToken);
    await registry.save({ ...connection, accessToken:refreshed.access_token, refreshToken:refreshed.refresh_token || connection.refreshToken, expiresAt:Date.now()+Number(refreshed.expires_in||3600)*1000, scopes:connection.scopes });
    connection = await registry.findProviderConnection({ userId:USER_ID, provider:"gmail" });
  }
  return connection;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, APP_ORIGIN);
    if (req.method === "GET" && url.pathname === "/api/health") return sendJson(res, 200, { ok:true, service:"openrabbit-prototype", gmailConfigured:Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) });
    if (req.method === "GET" && url.pathname === "/api/integrations/gmail/connect") {
      const redirectTo = safeAppPath(url.searchParams.get("redirectTo") || "/communications.html");
      const { url:authorizationUrl } = gmail.authorizationUrl({ userId:USER_ID, redirectTo });
      return redirect(res, authorizationUrl);
    }
    if (req.method === "GET" && url.pathname === "/api/integrations/gmail/callback") {
      const error = url.searchParams.get("error");
      if (error) return redirect(res, `/communications.html?gmail=error&reason=${encodeURIComponent(error)}`);
      const code=url.searchParams.get("code"), state=url.searchParams.get("state");
      if (!code || !state) return sendJson(res, 400, { error:"Missing OAuth code/state" });
      const result = await gmail.exchangeCode({ code, state });
      const destination = safeAppPath(result.redirectTo);
      return redirect(res, `${destination}${destination.includes("?")?"&":"?"}gmail=connected`);
    }
    if (req.method === "GET" && url.pathname === "/api/integrations/gmail/status") {
      const connection = await activeGmailConnection();
      return sendJson(res, 200, connection ? { connected:true, accountId:connection.accountId, scopes:connection.scopes } : { connected:false });
    }
    if (req.method === "GET" && url.pathname === "/api/integrations/gmail/inbox") {
      const connection = await activeGmailConnection();
      if (!connection) return sendJson(res, 401, { error:"Gmail not connected", connectUrl:"/api/integrations/gmail/connect" });
      const maxResults=Math.max(1,Math.min(30,Number(url.searchParams.get("limit")||12)));
      const query=url.searchParams.get("q")||"in:inbox";
      const inbox=await gmail.listInbox({ accessToken:connection.accessToken, maxResults, query });
      return sendJson(res, 200, { connected:true, accountId:connection.accountId, ...inbox });
    }
    if (req.method === "GET" && serveStatic(url.pathname, res)) return;
    return sendJson(res, 404, { error:"Not found" });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { error:error.message || "Prototype integration server failed" });
  }
});

server.listen(PORT, () => console.log(`OpenRabbit prototype running at ${APP_ORIGIN}`));