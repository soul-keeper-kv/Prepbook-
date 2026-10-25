"use strict";

// Local server for the app, started by start.sh. No dependencies: plain Node.
//  - Serves the project folder: the app fetches data/*.json, which browsers block
//    when index.html is opened as a file.
//  - Keeps the Google sign-in for Drive sync (/api/google/*). The page reads and
//    writes progress on Google Drive itself (main.js); this server only hands it an
//    access token. Signing in once stores a refresh token in progress/google-token.json,
//    so the browser never has to show Google's popup again.
// Usage: node server.js [--open]   (--open opens the app in the default browser)

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8080;
const HOST = "127.0.0.1";
const APP_URL = `http://localhost:${PORT}`;
const OPEN_BROWSER = process.argv.includes("--open");

// Google sign-in. google-oauth.json is the "Desktop app" OAuth client downloaded
// from Google Cloud (see README.md at the repository root); both files stay out of git.
const GOOGLE_API = "/api/google";
const OAUTH_CLIENT_FILE = path.join(ROOT, "google-oauth.json");
const TOKEN_FILE = path.join(ROOT, "progress", "google-token.json");
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file"; // only files this app created
// Google accepts any loopback port for Desktop clients; 127.0.0.1 is what it recommends.
const REDIRECT_URI = `http://127.0.0.1:${PORT}${GOOGLE_API}/callback`;
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const LOGIN_TTL_MS = 10 * 60 * 1000;
const TOKEN_MARGIN_MS = 60 * 1000; // refresh a little before Google's expiry

// Never served as static files: the OAuth client secret and the refresh token.
const PRIVATE_PATHS = [OAUTH_CLIENT_FILE, path.join(ROOT, "progress")];
// Requests for any other host name are refused, so a web page using DNS rebinding
// cannot reach the token endpoint through a domain that resolves to 127.0.0.1.
const ALLOWED_HOSTS = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function redirect(res, location) {
  res.writeHead(302, { Location: location, "Cache-Control": "no-store" }).end();
}

const escapeHtml = (text) => String(text).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

function sendPage(res, status, message) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  res.end(`<!DOCTYPE html><meta charset="utf-8"><title>DSA Roadmap</title>
<p style="font:16px system-ui;max-width:640px;margin:48px auto">${escapeHtml(message)}<br><br>
<a href="${APP_URL}/">Back to the app</a></p>`);
}

// ---------------------------------------------------------------------
// Google sign-in
// ---------------------------------------------------------------------

async function readJsonFile(file) {
  try {
    return JSON.parse(await fs.promises.readFile(file, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw new Error(`${path.relative(ROOT, file)} is not valid JSON (${err.message})`);
  }
}

// Read on every request, so dropping the file in works without restarting the server.
async function readOAuthClient() {
  const file = await readJsonFile(OAUTH_CLIENT_FILE);
  const client = file?.installed || file?.web;
  if (!client) return null;
  if (!client.client_id || !client.client_secret) {
    throw new Error("google-oauth.json has no client_id/client_secret; download it again from Google Cloud");
  }
  return client;
}

async function writeTokenFile(data) {
  await fs.promises.mkdir(path.dirname(TOKEN_FILE), { recursive: true });
  await fs.promises.writeFile(TOKEN_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

class GoogleError extends Error {
  constructor(status, body) {
    super(body.error_description || body.error || `HTTP ${status}`);
    this.code = body.error;
  }
}

async function postToken(params) {
  const res = await fetch(TOKEN_URL, { method: "POST", body: new URLSearchParams(params) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new GoogleError(res.status, body);
  return body;
}

// state -> PKCE verifier of logins started from this server, so the callback can only
// finish a login this server began.
const pendingLogins = new Map();
let accessToken = null; // { token, expiresAt } kept in memory only

async function startLogin(res) {
  const client = await readOAuthClient();
  if (!client) {
    sendPage(res, 400, "web/google-oauth.json is missing. Follow the Google Cloud steps in README.md (repository root) first.");
    return;
  }
  const state = crypto.randomBytes(16).toString("hex");
  const verifier = crypto.randomBytes(32).toString("base64url");
  pendingLogins.set(state, verifier);
  setTimeout(() => pendingLogins.delete(state), LOGIN_TTL_MS).unref();

  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: client.client_id,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: DRIVE_SCOPE,
    access_type: "offline", // ask for a refresh token
    prompt: "consent",      // Google only returns the refresh token on a fresh consent
    state,
    code_challenge: crypto.createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  });
  redirect(res, url.href);
}

async function finishLogin(query, res) {
  const verifier = pendingLogins.get(query.get("state"));
  pendingLogins.delete(query.get("state"));
  if (query.get("error")) {
    sendPage(res, 400, `Google sign-in was not completed: ${query.get("error")}`);
    return;
  }
  if (!verifier || !query.get("code")) {
    sendPage(res, 400, "This sign-in link has expired. Start again from the app.");
    return;
  }
  const client = await readOAuthClient();
  const tokens = await postToken({
    code: query.get("code"),
    client_id: client.client_id,
    client_secret: client.client_secret,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
    code_verifier: verifier,
  });
  if (!tokens.refresh_token) throw new Error("Google returned no refresh token");
  await writeTokenFile({ refresh_token: tokens.refresh_token, scope: tokens.scope, savedAt: new Date().toISOString() });
  accessToken = { token: tokens.access_token, expiresAt: Date.now() + tokens.expires_in * 1000 };
  redirect(res, `${APP_URL}/`);
}

// { accessToken, expiresAt } for main.js; 401 until the user has signed in.
async function getToken(res) {
  const client = await readOAuthClient();
  if (!client) {
    sendJson(res, 503, { error: "not configured" });
    return;
  }
  if (accessToken && accessToken.expiresAt - TOKEN_MARGIN_MS > Date.now()) {
    sendJson(res, 200, { accessToken: accessToken.token, expiresAt: accessToken.expiresAt });
    return;
  }
  const saved = await readJsonFile(TOKEN_FILE);
  if (!saved?.refresh_token) {
    sendJson(res, 401, { error: "not signed in" });
    return;
  }
  try {
    const tokens = await postToken({
      client_id: client.client_id,
      client_secret: client.client_secret,
      refresh_token: saved.refresh_token,
      grant_type: "refresh_token",
    });
    accessToken = { token: tokens.access_token, expiresAt: Date.now() + tokens.expires_in * 1000 };
    sendJson(res, 200, { accessToken: accessToken.token, expiresAt: accessToken.expiresAt });
  } catch (err) {
    if (err.code !== "invalid_grant") throw err;
    // Access was revoked, or expired (OAuth app left in "Testing": 7 days). Sign in again.
    await fs.promises.rm(TOKEN_FILE, { force: true });
    accessToken = null;
    sendJson(res, 401, { error: "not signed in" });
  }
}

async function handleGoogle(route, query, res) {
  if (route === "/status") {
    const configured = Boolean(await readOAuthClient());
    const connected = configured && Boolean((await readJsonFile(TOKEN_FILE))?.refresh_token);
    sendJson(res, 200, { configured, connected });
  } else if (route === "/token") {
    await getToken(res);
  } else if (route === "/login") {
    await startLogin(res);
  } else if (route === "/callback") {
    await finishLogin(query, res);
  } else {
    sendJson(res, 404, { error: "not found" });
  }
}

// ---------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------

function serveStatic(urlPath, res) {
  if (urlPath.endsWith("/")) urlPath += "index.html";

  // Never serve anything outside the project folder, or the private files inside it.
  const file = path.join(ROOT, urlPath);
  const isPrivate = PRIVATE_PATHS.some((p) => file === p || file.startsWith(p + path.sep));
  if (!file.startsWith(ROOT + path.sep) || isPrivate) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  fs.readFile(file, (err, body) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
      // Edited JSON shows up on the next reload.
      "Cache-Control": "no-cache",
    });
    res.end(body);
  });
}

const server = http.createServer((req, res) => {
  if (!ALLOWED_HOSTS.has(req.headers.host)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  let url;
  try {
    url = new URL(req.url, "http://localhost");
    url.decodedPath = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400).end("Bad request");
    return;
  }

  if (url.decodedPath.startsWith(`${GOOGLE_API}/`)) {
    if (req.method !== "GET") {
      res.writeHead(405, { Allow: "GET" }).end();
      return;
    }
    handleGoogle(url.decodedPath.slice(GOOGLE_API.length), url.searchParams, res).catch((err) => {
      console.error(`${req.method} ${url.pathname}: ${err.message}`);
      if (res.headersSent) return;
      if (url.decodedPath.endsWith("/callback")) sendPage(res, 500, `Google sign-in failed: ${err.message}`);
      else sendJson(res, 500, { error: err.message });
    });
    return;
  }
  serveStatic(url.decodedPath, res);
});

function openBrowser() {
  if (!OPEN_BROWSER) return;
  const [cmd, args] =
    process.platform === "win32" ? ["cmd", ["/c", "start", "", APP_URL]]
    : process.platform === "darwin" ? ["open", [APP_URL]]
    : ["xdg-open", [APP_URL]];
  spawn(cmd, args, { stdio: "ignore", detached: true, windowsHide: true })
    .on("error", () => console.log(`Open ${APP_URL} in your browser.`))
    .unref();
}

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    // Usually the app was already started in another window; reuse that server.
    console.log(`Port ${PORT} is already in use, assuming the app is already running.`);
    openBrowser();
    process.exit(0);
  }
  throw err;
});

server.listen(PORT, HOST, () => {
  console.log(`App running at ${APP_URL}`);
  console.log("Progress syncs through Google Drive once you connect it in the app. Press Ctrl+C to stop.");
  openBrowser();
});
