import { spawn } from "node:child_process"
import fs from "node:fs"
import http from "node:http"
import path from "node:path"
import { APP_PORT } from "./config.ts"
import { GOOGLE_API, createGoogleAuth } from "./google-auth.ts"

// Local server for the app on the PC, started by start.sh (or `npm start`).
//  - Serves the built app from dist/ (`npm run build`; start.sh builds first).
//  - Keeps the Google sign-in for Drive sync under /api/google/* (server/google-auth.ts).
// No dependencies: plain Node, which runs this TypeScript file directly (Node 22.18+).
// Usage: node server/serve.ts [--open]   (--open opens the app in the default browser)

const ROOT = path.resolve(import.meta.dirname, "..")
const DIST = path.join(ROOT, "dist")
// Shared with `npm run dev` (server/config.ts): one origin, one copy of the progress
const PORT = APP_PORT
const HOST = "127.0.0.1"
const APP_URL = `http://localhost:${PORT}`
const OPEN_BROWSER = process.argv.includes("--open")

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
}

if (!fs.existsSync(path.join(DIST, "index.html"))) {
  console.error("dist/ is missing: run `npm run build` first (start.sh does it for you).")
  process.exit(1)
}

const handleGoogle = createGoogleAuth({ root: ROOT })

function serveStatic(urlPath: string, res: http.ServerResponse) {
  let file = path.join(DIST, urlPath)
  // Never serve anything outside dist/
  if (file !== DIST && !file.startsWith(DIST + path.sep)) {
    res.writeHead(403).end("Forbidden")
    return
  }
  if (urlPath.endsWith("/")) file = path.join(file, "index.html")

  fs.readFile(file, (err, body) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found")
      return
    }
    // Files in assets/ have a content hash in their name, so they never change
    const immutable = urlPath.startsWith("/assets/")
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
      "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
    })
    res.end(body)
  })
}

const server = http.createServer((req, res) => {
  let url: URL
  let decodedPath: string
  try {
    url = new URL(req.url ?? "/", "http://localhost")
    decodedPath = decodeURIComponent(url.pathname)
    // A NUL byte (%00) makes fs throw synchronously, which would take the server down
    if (decodedPath.includes("\0")) throw new Error("NUL in path")
  } catch {
    res.writeHead(400).end("Bad request")
    return
  }

  if (decodedPath.startsWith(`${GOOGLE_API}/`)) {
    void handleGoogle(req, res, {
      route: decodedPath.slice(GOOGLE_API.length),
      query: url.searchParams,
      port: PORT,
    })
    return
  }
  if (req.headers.host !== `localhost:${PORT}` && req.headers.host !== `127.0.0.1:${PORT}`) {
    res.writeHead(403).end("Forbidden")
    return
  }
  serveStatic(decodedPath, res)
})

function openBrowser() {
  if (!OPEN_BROWSER) return
  const [cmd, args]: [string, string[]] =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", APP_URL]]
      : process.platform === "darwin"
        ? ["open", [APP_URL]]
        : ["xdg-open", [APP_URL]]
  spawn(cmd, args, { stdio: "ignore", detached: true, windowsHide: true })
    .on("error", () => console.log(`Open ${APP_URL} in your browser.`))
    .unref()
}

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    // Usually the app was already started in another window; reuse that server
    console.log(`Port ${PORT} is already in use, assuming the app is already running.`)
    openBrowser()
    process.exit(0)
  }
  throw err
})

server.listen(PORT, HOST, () => {
  console.log(`App running at ${APP_URL}`)
  console.log(
    "Progress syncs through Google Drive once you connect it in the app. Press Ctrl+C to stop."
  )
  openBrowser()
})
