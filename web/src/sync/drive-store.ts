import { z } from "zod"
import { nowIso } from "@/lib/dates"
import { AppError } from "@/lib/errors"
import { parseNotebook, type Notebook } from "@/notebook/schema"

// The notebook file on Google Drive, through the Drive REST API v3.
// The app only has the drive.file scope: it sees the files it created and nothing else.
//
// Not the file of the old roadmap app (dsa-roadmap-progress.json): an old copy of the app
// still installed somewhere keeps writing that one, and would drop the notebook from it.

const DRIVE_FILES = "https://www.googleapis.com/drive/v3/files"
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files"
export const DRIVE_FILE_NAME = "interview-prep-notebook.json"
// Tag on the file, so it is found again after being renamed or moved to another folder
const DRIVE_TAG = { key: "prepNotebook", value: "notebook" }
const TOKEN_MARGIN_MS = 60 * 1000 // fetch a new token a little before the old one expires

/** The user has to sign in (again) before the app can reach Drive */
export class NeedLogin extends Error {
  name = "NeedLogin"
}

/** The request never reached the server: no network, or the local server is not running */
export class Offline extends Error {
  name = "Offline"
}

export interface Token {
  value: string
  expiresAt: number
}

/** Where access tokens come from: the local server on the PC, Play services on Android */
export interface DriveAuth {
  getToken(): Promise<Token>
  clearToken(token: string): Promise<void>
  /** Shows Google's sign-in. Resolves with a token, or never (when the page navigates away) */
  login(): Promise<Token | null>
}

const DriveFileSchema = z.object({ id: z.string(), version: z.string() })
export type DriveFile = z.infer<typeof DriveFileSchema>

export interface DriveStore {
  /** The file with this id; null when it was deleted or is in the trash */
  getFile(id: string): Promise<DriveFile | null>
  /** The newest notebook file the app created */
  findFile(): Promise<DriveFile | null>
  download(id: string): Promise<Notebook>
  /** Overwrites the file, or creates it when there is no id yet */
  write(id: string | undefined, doc: Notebook): Promise<DriveFile>
  setToken(token: Token | null): void
}

// Not indented: the notebook grows with every note, and Drive stores it as sent
const notebookJson = (doc: Notebook) => `${JSON.stringify({ savedAt: nowIso(), ...doc })}\n`

export function createDriveStore(auth: DriveAuth, fetchFn: typeof fetch = fetch): DriveStore {
  let token: Token | null = null

  const request = (url: string, init?: RequestInit) =>
    // fetch only rejects (TypeError) when the request could not be sent
    fetchFn(url, init).catch(() => {
      throw new Offline()
    })

  async function accessToken() {
    if (!token || token.expiresAt - TOKEN_MARGIN_MS < Date.now()) token = await auth.getToken()
    return token.value
  }

  async function driveFetch(
    url: string,
    init: RequestInit = {},
    { allow404 = false, retry = true } = {}
  ): Promise<Response | null> {
    const value = await accessToken()
    const headers = new Headers(init.headers)
    headers.set("Authorization", `Bearer ${value}`)
    const res = await request(url, { ...init, headers })
    if (res.status === 401 && retry) {
      // Token expired or revoked: drop it, get a new one and try once more
      token = null
      await auth.clearToken(value)
      return driveFetch(url, init, { allow404, retry: false })
    }
    if (res.status === 404 && allow404) return null
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      throw new Error(body?.error?.message || `HTTP ${res.status}`)
    }
    return res
  }

  const fileUrl = (id: string, params: Record<string, string>) =>
    `${DRIVE_FILES}/${encodeURIComponent(id)}?${new URLSearchParams(params)}`

  return {
    setToken(next) {
      token = next
    },

    async getFile(id) {
      const res = await driveFetch(
        fileUrl(id, { fields: "id,version,trashed" }),
        {},
        { allow404: true }
      )
      if (!res) return null
      const file = z
        .object({ trashed: z.boolean().optional() })
        .and(DriveFileSchema)
        .parse(await res.json())
      return file.trashed ? null : { id: file.id, version: file.version }
    },

    async findFile() {
      const params = new URLSearchParams({
        q: `appProperties has { key='${DRIVE_TAG.key}' and value='${DRIVE_TAG.value}' } and trashed = false`,
        spaces: "drive",
        orderBy: "modifiedTime desc",
        fields: "files(id,version)",
        pageSize: "1",
      })
      const res = await driveFetch(`${DRIVE_FILES}?${params}`)
      const { files } = z.object({ files: z.array(DriveFileSchema) }).parse(await res!.json())
      return files[0] ?? null
    },

    async download(id) {
      const res = await driveFetch(fileUrl(id, { alt: "media" }))
      const doc = parseNotebook(await res!.json().catch(() => null))
      // Edited by hand into something else: report it rather than overwrite it
      if (!doc) throw new AppError("sync.badFile", { file: DRIVE_FILE_NAME })
      return doc
    },

    async write(id, doc) {
      if (id) {
        const res = await driveFetch(
          `${DRIVE_UPLOAD}/${encodeURIComponent(id)}?uploadType=media&fields=id,version`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: notebookJson(doc),
          }
        )
        return DriveFileSchema.parse(await res!.json())
      }
      // New file: metadata (name, tag) and content in one multipart request
      const boundary = `prep-${Math.random().toString(36).slice(2)}`
      const metadata = {
        name: DRIVE_FILE_NAME,
        mimeType: "application/json",
        appProperties: { [DRIVE_TAG.key]: DRIVE_TAG.value },
      }
      const body = [
        `--${boundary}`,
        "Content-Type: application/json; charset=UTF-8",
        "",
        JSON.stringify(metadata),
        `--${boundary}`,
        "Content-Type: application/json",
        "",
        notebookJson(doc),
        `--${boundary}--`,
        "",
      ].join("\r\n")
      const res = await driveFetch(`${DRIVE_UPLOAD}?uploadType=multipart&fields=id,version`, {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body,
      })
      return DriveFileSchema.parse(await res!.json())
    },
  }
}
