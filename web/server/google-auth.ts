import crypto from "node:crypto"
import fs from "node:fs/promises"
import type { IncomingMessage, ServerResponse } from "node:http"
import path from "node:path"

// Google sign-in for Drive sync on the PC. The page talks to the Drive API itself; this only
// hands it an access token. Signing in once stores a refresh token in progress/google-token.json,
// so the browser never has to show Google's screen again.
// Used by server/serve.ts (start.sh) and by the Vite dev server (vite.config.ts).
//
//   GET /api/google/status    { configured, connected }
//   GET /api/google/token     { accessToken, expiresAt }; 401 until signed in
//   GET /api/google/login     redirects to Google
//   GET /api/google/callback  Google redirects back here, then on to the app
//
// google-oauth.json is the "Desktop app" OAuth client downloaded from Google Cloud
// (see README.md at the repository root). Both files stay out of git.

export const GOOGLE_API = "/api/google"

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file" // only files this app created
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const TOKEN_URL = "https://oauth2.googleapis.com/token"
const LOGIN_TTL_MS = 10 * 60 * 1000
const TOKEN_MARGIN_MS = 60 * 1000 // refresh a little before Google's expiry

interface OAuthClient {
  client_id: string
  client_secret: string
}

interface TokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope?: string
}

export interface GoogleRequest {
  /** Path after /api/google, e.g. "/token" */
  route: string
  query: URLSearchParams
  /** Port the app is served on; part of the redirect address and the allowed Host header */
  port: number
}

class GoogleError extends Error {
  readonly code: string | undefined
  constructor(status: number, body: { error?: string; error_description?: string }) {
    super(body.error_description || body.error || `HTTP ${status}`)
    this.code = body.error
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  })
  res.end(JSON.stringify(body))
}

function redirect(res: ServerResponse, location: string) {
  res.writeHead(302, { Location: location, "Cache-Control": "no-store" }).end()
}

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)

function sendPage(res: ServerResponse, status: number, message: string, appUrl: string) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" })
  res.end(`<!DOCTYPE html><meta charset="utf-8"><title>DSA Roadmap</title>
<p style="font:16px system-ui;max-width:640px;margin:48px auto">${escapeHtml(message)}<br><br>
<a href="${appUrl}">Back to the app</a></p>`)
}

async function readJsonFile<T>(file: string, root: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null
    throw new Error(`${path.relative(root, file)} is not valid JSON (${(err as Error).message})`, {
      cause: err,
    })
  }
}

async function postToken(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, { method: "POST", body: new URLSearchParams(params) })
  const body = (await res.json().catch(() => ({}))) as TokenResponse & {
    error?: string
    error_description?: string
  }
  if (!res.ok) throw new GoogleError(res.status, body)
  return body
}

export function createGoogleAuth({ root }: { root: string }) {
  const clientFile = path.join(root, "google-oauth.json")
  const tokenFile = path.join(root, "progress", "google-token.json")
  // state -> PKCE verifier of logins started here (so the callback only finishes those),
  // and the address the app was opened on, to send the browser back to it
  const pendingLogins = new Map<string, { verifier: string; appUrl: string }>()
  let accessToken: { token: string; expiresAt: number } | null = null

  // Read on every request, so dropping the file in works without a restart
  async function readClient(): Promise<OAuthClient | null> {
    const file = await readJsonFile<{ installed?: OAuthClient; web?: OAuthClient }>(
      clientFile,
      root
    )
    const client = file?.installed ?? file?.web
    if (!client) return null
    if (!client.client_id || !client.client_secret) {
      throw new Error(
        "google-oauth.json has no client_id/client_secret; download it again from Google Cloud"
      )
    }
    return client
  }

  const redirectUri = (port: number) => `http://127.0.0.1:${port}${GOOGLE_API}/callback`

  async function startLogin(res: ServerResponse, port: number, appUrl: string) {
    const client = await readClient()
    if (!client) {
      sendPage(
        res,
        400,
        "web/google-oauth.json is missing. Follow the Google Cloud steps in README.md first.",
        appUrl
      )
      return
    }
    const state = crypto.randomBytes(16).toString("hex")
    const verifier = crypto.randomBytes(32).toString("base64url")
    pendingLogins.set(state, { verifier, appUrl })
    setTimeout(() => pendingLogins.delete(state), LOGIN_TTL_MS).unref()

    const url = new URL(AUTH_URL)
    url.search = new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: redirectUri(port),
      response_type: "code",
      scope: DRIVE_SCOPE,
      access_type: "offline", // ask for a refresh token
      prompt: "consent", // Google only returns the refresh token on a fresh consent
      state,
      code_challenge: crypto.createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
    }).toString()
    redirect(res, url.href)
  }

  async function finishLogin(
    query: URLSearchParams,
    res: ServerResponse,
    port: number,
    fallbackUrl: string
  ) {
    const state = query.get("state") ?? ""
    const login = pendingLogins.get(state)
    pendingLogins.delete(state)
    // Back to the address the app was opened on (localhost or 127.0.0.1): the progress saved
    // in the browser belongs to that origin. The callback itself always arrives on 127.0.0.1.
    const appUrl = login?.appUrl ?? fallbackUrl
    const code = query.get("code")
    if (query.get("error")) {
      sendPage(res, 400, `Google sign-in was not completed: ${query.get("error")}`, appUrl)
      return
    }
    const client = await readClient()
    if (!login || !code || !client) {
      sendPage(res, 400, "This sign-in link has expired. Start again from the app.", appUrl)
      return
    }
    const { verifier } = login
    const tokens = await postToken({
      code,
      client_id: client.client_id,
      client_secret: client.client_secret,
      redirect_uri: redirectUri(port),
      grant_type: "authorization_code",
      code_verifier: verifier,
    })
    if (!tokens.refresh_token) throw new Error("Google returned no refresh token")
    await fs.mkdir(path.dirname(tokenFile), { recursive: true })
    const saved = {
      refresh_token: tokens.refresh_token,
      scope: tokens.scope,
      savedAt: new Date().toISOString(),
    }
    await fs.writeFile(tokenFile, `${JSON.stringify(saved, null, 2)}\n`, "utf8")
    accessToken = { token: tokens.access_token, expiresAt: Date.now() + tokens.expires_in * 1000 }
    redirect(res, appUrl)
  }

  async function sendToken(res: ServerResponse) {
    const client = await readClient()
    if (!client) {
      sendJson(res, 503, { error: "not configured" })
      return
    }
    if (accessToken && accessToken.expiresAt - TOKEN_MARGIN_MS > Date.now()) {
      sendJson(res, 200, { accessToken: accessToken.token, expiresAt: accessToken.expiresAt })
      return
    }
    const saved = await readJsonFile<{ refresh_token?: string }>(tokenFile, root)
    if (!saved?.refresh_token) {
      sendJson(res, 401, { error: "not signed in" })
      return
    }
    try {
      const tokens = await postToken({
        client_id: client.client_id,
        client_secret: client.client_secret,
        refresh_token: saved.refresh_token,
        grant_type: "refresh_token",
      })
      accessToken = { token: tokens.access_token, expiresAt: Date.now() + tokens.expires_in * 1000 }
      sendJson(res, 200, { accessToken: accessToken.token, expiresAt: accessToken.expiresAt })
    } catch (err) {
      if (!(err instanceof GoogleError) || err.code !== "invalid_grant") throw err
      // Access was revoked, or expired (OAuth app left in "Testing": 7 days). Sign in again.
      await fs.rm(tokenFile, { force: true })
      accessToken = null
      sendJson(res, 401, { error: "not signed in" })
    }
  }

  return async function handleGoogle(
    req: IncomingMessage,
    res: ServerResponse,
    { route, query, port }: GoogleRequest
  ) {
    // Refuse other host names, so a web page using DNS rebinding cannot reach the token
    // endpoint through a domain that resolves to 127.0.0.1
    const allowedHosts = [`localhost:${port}`, `127.0.0.1:${port}`]
    const host = req.headers.host ?? ""
    // Browsers send Origin on cross-origin requests: refuse pages from other origins (another
    // localhost port, say), so they cannot read the access token even if CORS were open
    const origin = req.headers.origin
    if (!allowedHosts.includes(host) || (origin && origin !== `http://${host}`)) {
      res.writeHead(403).end("Forbidden")
      return
    }
    const appUrl = `http://${host}/`
    if (req.method !== "GET") {
      res.writeHead(405, { Allow: "GET" }).end()
      return
    }
    try {
      if (route === "/status") {
        const configured = Boolean(await readClient())
        const token = configured
          ? await readJsonFile<{ refresh_token?: string }>(tokenFile, root)
          : null
        sendJson(res, 200, { configured, connected: Boolean(token?.refresh_token) })
      } else if (route === "/token") {
        await sendToken(res)
      } else if (route === "/login") {
        await startLogin(res, port, appUrl)
      } else if (route === "/callback") {
        await finishLogin(query, res, port, `http://localhost:${port}/`)
      } else {
        sendJson(res, 404, { error: "not found" })
      }
    } catch (err) {
      const message = (err as Error).message
      console.error(`GET ${GOOGLE_API}${route}: ${message}`)
      if (res.headersSent) return
      if (route === "/callback") sendPage(res, 500, `Google sign-in failed: ${message}`, appUrl)
      else sendJson(res, 500, { error: message })
    }
  }
}
