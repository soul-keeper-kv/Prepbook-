import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DriveSync, SAVE_DELAY_MS, type SyncRecord, type SyncState } from "@/sync/engine"
import {
  NeedLogin,
  Offline,
  type DriveAuth,
  type DriveFile,
  type DriveStore,
} from "@/sync/drive-store"
import type { Progress } from "@/progress/schema"

// An in-memory Drive with one file; every write bumps its version, like the real one
class FakeDrive implements DriveStore {
  file: (DriveFile & { progress: Progress }) | null = null
  writes = 0
  failWith: Error | null = null

  seed(progress: Progress, id = "f1") {
    this.file = { id, version: "1", progress: structuredClone(progress) }
  }
  private check() {
    if (this.failWith) throw this.failWith
  }
  async getFile(id: string) {
    this.check()
    return this.file?.id === id ? { id, version: this.file.version } : null
  }
  async findFile() {
    this.check()
    return this.file ? { id: this.file.id, version: this.file.version } : null
  }
  async download() {
    this.check()
    return structuredClone(this.file!.progress)
  }
  async write(id: string | undefined, progress: Progress) {
    this.check()
    this.writes++
    const version = String(Number(this.file?.version ?? 0) + 1)
    this.file = { id: id ?? "f1", version, progress: structuredClone(progress) }
    return { id: this.file.id, version }
  }
  setToken() {}
}

const auth: DriveAuth = {
  getToken: async () => ({ value: "t", expiresAt: Date.now() + 3_600_000 }),
  clearToken: async () => {},
  login: async () => ({ value: "t", expiresAt: Date.now() + 3_600_000 }),
}

function setup(local: Progress, record: SyncRecord | null = null) {
  const drive = new FakeDrive()
  const state = { local: structuredClone(local), record, statuses: [] as SyncState["status"][] }
  const sync = new DriveSync({
    readRecord: () => state.record,
    writeRecord: (r) => {
      state.record = r
    },
    getProgress: () => state.local,
    applyRemote: (p) => {
      state.local = p
    },
    onState: (s) => state.statuses.push(s.status),
    createStore: () => drive,
  })
  return { drive, state, sync }
}

const progress = (items: Progress["items"], solved: Progress["solved"] = {}): Progress => ({
  items,
  solved,
})

describe("DriveSync", () => {
  it("creates the Drive file on the first sync when there is none", async () => {
    const { drive, state, sync } = setup(progress({ a: { done: true } }))
    sync.attach(auth)
    await vi.waitFor(() => expect(state.statuses.at(-1)).toBe("synced"))
    expect(drive.file?.progress).toEqual(progress({ a: { done: true } }))
    expect(state.record).toEqual({ fileId: "f1", version: "1", pending: false })
  })

  it("first sync with an existing file: merges, Drive wins on the same field, uploads the union", async () => {
    const { drive, state, sync } = setup(progress({ a: { notes: "local" }, b: { done: true } }))
    drive.seed(progress({ a: { notes: "drive" }, c: { done: true } }))
    await sync.connect() // not attached yet: no-op
    sync.attach(auth)
    await vi.waitFor(() => expect(state.statuses.at(-1)).toBe("synced"))
    const expected = progress({ a: { notes: "drive" }, b: { done: true }, c: { done: true } })
    expect(state.local).toEqual(expected)
    expect(drive.file?.progress).toEqual(expected)
  })

  it("takes Drive's copy as is when this device has nothing pending", async () => {
    const { drive, state, sync } = setup(progress({ a: { notes: "old" } }), {
      fileId: "f1",
      version: "1",
      pending: false,
    })
    drive.seed(progress({ a: { notes: "from phone" } }))
    drive.file!.version = "2" // the other device wrote since
    sync.attach(auth)
    await vi.waitFor(() => expect(state.statuses.at(-1)).toBe("synced"))
    expect(state.local).toEqual(progress({ a: { notes: "from phone" } }))
    expect(drive.writes).toBe(0)
  })

  it("keeps local changes over Drive's when they are pending", async () => {
    const { drive, state, sync } = setup(progress({ a: { notes: "typed offline" } }), {
      fileId: "f1",
      version: "1",
      pending: true,
    })
    drive.seed(progress({ a: { notes: "from phone", done: true } }))
    drive.file!.version = "2"
    sync.attach(auth)
    await vi.waitFor(() => expect(state.statuses.at(-1)).toBe("synced"))
    const expected = progress({ a: { notes: "typed offline", done: true } })
    expect(state.local).toEqual(expected)
    expect(drive.file?.progress).toEqual(expected)
    expect(state.record?.pending).toBe(false)
  })

  it("re-creates the file when it was deleted on Drive", async () => {
    const { drive, state, sync } = setup(progress({ a: { done: true } }), {
      fileId: "gone",
      version: "5",
      pending: false,
    })
    sync.attach(auth)
    await vi.waitFor(() => expect(state.statuses.at(-1)).toBe("synced"))
    expect(drive.file?.progress).toEqual(progress({ a: { done: true } }))
  })

  it("reports offline and needs-login without losing local data", async () => {
    const local = progress({ a: { done: true } })
    const offline = setup(local)
    offline.drive.failWith = new Offline()
    offline.sync.attach(auth)
    await vi.waitFor(() => expect(offline.state.statuses.at(-1)).toBe("offline"))
    expect(offline.state.local).toEqual(local)

    const login = setup(local)
    login.drive.failWith = new NeedLogin()
    login.sync.attach(auth)
    await vi.waitFor(() => expect(login.state.statuses.at(-1)).toBe("login"))
  })

  describe("saving local changes", () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it("marks the change pending and uploads once after a burst of edits", async () => {
      const { drive, state, sync } = setup(progress({}))
      sync.attach(auth)
      await vi.waitFor(() => expect(state.statuses.at(-1)).toBe("synced"))
      const writesAfterStart = drive.writes

      for (const notes of ["a", "ab", "abc"]) {
        state.local = progress({ x: { notes } })
        sync.notifyLocalChange()
      }
      expect(state.record?.pending).toBe(true)
      expect(drive.writes).toBe(writesAfterStart)

      await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
      await vi.waitFor(() => expect(state.record?.pending).toBe(false))
      expect(drive.writes).toBe(writesAfterStart + 1)
      expect(drive.file?.progress).toEqual(progress({ x: { notes: "abc" } }))
    })

    it("does not schedule uploads while waiting for sign-in", async () => {
      const { drive, state, sync } = setup(progress({}))
      drive.failWith = new NeedLogin()
      sync.attach(auth)
      await vi.waitFor(() => expect(state.statuses.at(-1)).toBe("login"))
      drive.failWith = null
      sync.notifyLocalChange()
      expect(sync.hasPendingSave).toBe(false)
      expect(state.record?.pending).toBe(true) // still remembered for later
    })
  })
})
