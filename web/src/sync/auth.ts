import { Capacitor, registerPlugin } from "@capacitor/core"
import { NeedLogin, Offline, type DriveAuth, type Token } from "@/sync/drive-store"

// Where the Drive access token comes from depends on how the app was opened:
//   PC (start.sh / npm run dev): the local server keeps the Google sign-in, see server/google-auth.ts
//   Android app: Google Play services, through GoogleDrivePlugin.java in mobile/android
//   Anything else (another static server): no Drive, progress stays in the browser

export const GOOGLE_API = "/api/google"

export const isNativeApp = () => Capacitor.isNativePlatform()

const serverAuth: DriveAuth = {
  async getToken() {
    const res = await fetch(`${GOOGLE_API}/token`, { cache: "no-store" }).catch(() => {
      throw new Offline()
    })
    const body = (await res.json().catch(() => ({}))) as {
      accessToken?: string
      expiresAt?: number
      error?: string
    }
    if (res.status === 401) throw new NeedLogin()
    if (!res.ok || !body.accessToken) throw new Error(body.error || `HTTP ${res.status}`)
    return { value: body.accessToken, expiresAt: body.expiresAt ?? 0 }
  },
  async clearToken() {},
  login() {
    // Google sends the browser back to the app when done (server/google-auth.ts)
    window.location.href = `${GOOGLE_API}/login`
    return new Promise<null>(() => {})
  },
}

interface GoogleDrivePlugin {
  /** interactive=false rejects with code NEED_CONSENT instead of showing Google's screens */
  getAccessToken(options: { interactive: boolean }): Promise<{ accessToken: string }>
  clearToken(options: { token: string }): Promise<void>
}

function androidAuth(): DriveAuth {
  const plugin = registerPlugin<GoogleDrivePlugin>("GoogleDrive")
  const getToken = async (interactive: boolean): Promise<Token> => {
    try {
      const { accessToken } = await plugin.getAccessToken({ interactive })
      // Play services does not say when the token expires: keep it short; if it expires
      // sooner, Drive answers 401 and a new one is requested
      return { value: accessToken, expiresAt: Date.now() + 10 * 60 * 1000 }
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === "NEED_CONSENT" || code === "CANCELLED") throw new NeedLogin()
      throw err
    }
  }
  return {
    getToken: () => getToken(false),
    clearToken: (token) => plugin.clearToken({ token }).catch(() => {}),
    login: () => getToken(true),
  }
}

export type DetectedAuth = { auth: DriveAuth; configured: boolean } | null

export async function detectAuth(): Promise<DetectedAuth> {
  if (isNativeApp()) return { auth: androidAuth(), configured: true }
  try {
    const res = await fetch(`${GOOGLE_API}/status`, { cache: "no-store" })
    if (!res.ok) return null
    const { configured } = (await res.json()) as { configured?: boolean }
    return { auth: serverAuth, configured: Boolean(configured) }
  } catch {
    return null // a static server without this API
  }
}
