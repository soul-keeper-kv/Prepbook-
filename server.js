"use strict";

// Local server for the app, started by start.sh. No dependencies: plain Node.
//  - Serves the project folder: the app fetches data/*.json, which browsers block
//    when index.html is opened as a file.
//  - GET/PUT /api/progress reads/writes progress/progress.json, so progress
//    survives switching browsers.
// Usage: node server.js [--open]   (--open opens the app in the default browser)

const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8080;
const HOST = "127.0.0.1";
const APP_URL = `http://localhost:${PORT}`;
const OPEN_BROWSER = process.argv.includes("--open");

const PROGRESS_API = "/api/progress";
const PROGRESS_FILE = path.join(ROOT, "progress", "progress.json");
const MAX_BODY_BYTES = 20 * 1024 * 1024;

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

const isObject = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(body === undefined ? undefined : JSON.stringify(body));
}

// ---------------------------------------------------------------------
// Progress file
// ---------------------------------------------------------------------

// null when the file does not exist yet; throws when it is not valid JSON,
// so a hand-broken file is reported instead of being overwritten.
async function readProgressFile() {
  let text;
  try {
    text = await fs.promises.readFile(PROGRESS_FILE, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`progress/progress.json is not valid JSON (${err.message})`);
  }
}

async function writeFileAtomic(file, text) {
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.promises.writeFile(tmp, text, "utf8");
  try {
    await fs.promises.rename(tmp, file);
  } catch {
    // Windows can refuse the rename while another program holds the file open.
    await fs.promises.writeFile(file, text, "utf8");
    await fs.promises.rm(tmp, { force: true });
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("request body too large"));
        req.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

// Writes run one at a time, so the check-then-write below cannot interleave.
let writeQueue = Promise.resolve();

async function handleProgress(req, res) {
  if (req.method === "GET") {
    sendJson(res, 200, await readProgressFile());
    return;
  }
  if (req.method !== "PUT") {
    res.writeHead(405, { Allow: "GET, PUT" }).end();
    return;
  }

  let data;
  try {
    data = JSON.parse(await readBody(req));
  } catch (err) {
    sendJson(res, 400, { error: err.message });
    return;
  }
  if (!isObject(data) || typeof data.savedAt !== "string" || !isObject(data.items) || !isObject(data.solved)) {
    sendJson(res, 400, { error: "expected { savedAt, baseSavedAt, items, solved }" });
    return;
  }

  const job = writeQueue.then(async () => {
    // baseSavedAt is the version the browser started from. If the file has moved on
    // since (another browser saved), refuse instead of silently dropping that work.
    const current = await readProgressFile();
    if (current && current.savedAt !== data.baseSavedAt) return 409;
    const file = { savedAt: data.savedAt, items: data.items, solved: data.solved };
    await writeFileAtomic(PROGRESS_FILE, `${JSON.stringify(file, null, 2)}\n`);
    return 200;
  });
  writeQueue = job.catch(() => {});

  const status = await job;
  if (status === 409) sendJson(res, 409, { error: "conflict" });
  else sendJson(res, 200, { savedAt: data.savedAt });
}

// ---------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------

function serveStatic(urlPath, res) {
  if (urlPath.endsWith("/")) urlPath += "index.html";

  // Never serve anything outside the project folder.
  const file = path.join(ROOT, urlPath);
  if (!file.startsWith(ROOT + path.sep)) {
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
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400).end("Bad request");
    return;
  }

  if (urlPath === PROGRESS_API) {
    handleProgress(req, res).catch((err) => {
      console.error(`${req.method} ${PROGRESS_API}: ${err.message}`);
      if (!res.headersSent) sendJson(res, 500, { error: err.message });
    });
    return;
  }
  serveStatic(urlPath, res);
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
  console.log("Progress is saved to progress/progress.json. Press Ctrl+C to stop.");
  openBrowser();
});
