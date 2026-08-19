"use strict";

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, shell } = require("electron");

const UI_ROOT = path.join(__dirname, "..", "clients", "real-estate-workspace");
const DEFAULT_API_BASE_URL = "http://127.0.0.1:3000";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

function apiBaseUrl() {
  const configured = String(process.env.OPENRABBIT_API_BASE_URL || DEFAULT_API_BASE_URL).trim();
  return new URL(configured);
}

function safeUiPath(requestPath) {
  const pathname = decodeURIComponent(new URL(requestPath, "http://127.0.0.1").pathname);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const candidate = path.resolve(UI_ROOT, relative);
  const root = path.resolve(UI_ROOT) + path.sep;
  return candidate.startsWith(root) || candidate === path.resolve(UI_ROOT, "index.html")
    ? candidate
    : null;
}

function proxyApiRequest(req, res) {
  const targetBase = apiBaseUrl();
  const target = new URL(req.url, targetBase);
  const transport = target.protocol === "https:" ? https : http;
  const headers = { ...req.headers, host: target.host };

  const upstream = transport.request(
    target,
    { method: req.method, headers },
    (upstreamResponse) => {
      res.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      upstreamResponse.pipe(res);
    },
  );

  upstream.on("error", (error) => {
    if (!res.headersSent) {
      res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
    }
    res.end(JSON.stringify({
      error: {
        code: "desktop_api_unavailable",
        message: `OpenRabbit API unavailable: ${error.message}`,
      },
    }));
  });

  req.pipe(upstream);
}

function serveUi(req, res) {
  let filePath;
  try {
    filePath = safeUiPath(req.url);
  } catch {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "content-type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

function createDesktopServer() {
  const server = http.createServer((req, res) => {
    if (req.url === "/healthz") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, apiBaseUrl: apiBaseUrl().origin }));
      return;
    }

    if (req.url && req.url.startsWith("/v1/")) {
      proxyApiRequest(req, res);
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { allow: "GET, HEAD" });
      res.end("Method not allowed");
      return;
    }

    serveUi(req, res);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function createMainWindow(server) {
  const address = server.address();
  if (!address || typeof address !== "object") throw new Error("Desktop server failed to bind");

  const window = new BrowserWindow({
    title: "OpenRabbit",
    width: 1440,
    height: 940,
    minWidth: 1040,
    minHeight: 720,
    show: false,
    backgroundColor: "#ffffff",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    const localOrigin = `http://127.0.0.1:${address.port}`;
    if (!url.startsWith(localOrigin)) {
      event.preventDefault();
      if (/^https?:/i.test(url)) void shell.openExternal(url);
    }
  });

  void window.loadURL(`http://127.0.0.1:${address.port}/`);
  return window;
}

let desktopServer;

app.whenReady().then(async () => {
  desktopServer = await createDesktopServer();
  createMainWindow(desktopServer);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0 && desktopServer) createMainWindow(desktopServer);
  });
}).catch((error) => {
  console.error("OpenRabbit desktop failed to start", error);
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (desktopServer) desktopServer.close();
});
