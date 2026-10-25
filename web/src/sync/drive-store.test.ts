import { describe, expect, it, vi } from "vitest"
import { AppError } from "@/lib/errors"
import { emptyNotebook } from "@/notebook/schema"
import { createDriveStore, Offline, type DriveAuth } from "@/sync/drive-store"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

function fakeAuth() {
  let n = 0
  return {
    getToken: vi.fn(async () => ({ value: `token-${++n}`, expiresAt: Date.now() + 3_600_000 })),
    clearToken: vi.fn(async () => {}),
    login: vi.fn(async () => null),
  } satisfies DriveAuth
}

describe("createDriveStore", () => {
  it("retries once with a fresh token after a 401", async () => {
    const auth = fakeAuth()
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ error: { message: "expired" } }, 401))
      .mockResolvedValueOnce(json({ files: [{ id: "f1", version: "3" }] }))
    const store = createDriveStore(auth, fetchFn)

    await expect(store.findFile()).resolves.toEqual({ id: "f1", version: "3" })
    expect(auth.clearToken).toHaveBeenCalledWith("token-1")
    const headers = new Headers(fetchFn.mock.calls[1]?.[1]?.headers)
    expect(headers.get("Authorization")).toBe("Bearer token-2")
  })

  it("turns a network failure into Offline", async () => {
    const store = createDriveStore(
      fakeAuth(),
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fail"))
    )
    await expect(store.findFile()).rejects.toBeInstanceOf(Offline)
  })

  it("treats a trashed or missing file as gone", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ id: "f1", version: "2", trashed: true }))
      .mockResolvedValueOnce(json({ error: { message: "not found" } }, 404))
    const store = createDriveStore(fakeAuth(), fetchFn)
    await expect(store.getFile("f1")).resolves.toBeNull()
    await expect(store.getFile("f1")).resolves.toBeNull()
  })

  it("refuses a downloaded file that is not a notebook", async () => {
    const store = createDriveStore(
      fakeAuth(),
      vi.fn<typeof fetch>().mockResolvedValue(json({ hello: 1 }))
    )
    await expect(store.download("f1")).rejects.toMatchObject({ key: "sync.badFile" })
    await expect(store.download("f1")).rejects.toBeInstanceOf(AppError)
  })

  it("creates a tagged file with one multipart request", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(json({ id: "new", version: "1" }))
    const store = createDriveStore(fakeAuth(), fetchFn)
    await expect(store.write(undefined, emptyNotebook())).resolves.toEqual({
      id: "new",
      version: "1",
    })
    const [url, init] = fetchFn.mock.calls[0] ?? []
    expect(String(url)).toContain("uploadType=multipart")
    expect(String(init?.body)).toContain('"appProperties":{"prepNotebook":"notebook"}')
  })
})
