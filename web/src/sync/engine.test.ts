import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DriveSync, SAVE_DELAY_MS, type SyncRecord, type SyncState } from "@/sync/engine"
import {
  NeedLogin,
  Offline,
  type DriveAuth,
  type DriveFile,
  type DriveStore,
} from "@/sync/drive-store"
import { emptyNotebook, type Notebook, type Topic } from "@/notebook/schema"

// An in-memory Drive with one file; every write bumps its version, like the real one
class FakeDrive implements DriveStore {
  file: (DriveFile & { doc: Notebook }) | null = null
  writes = 0
  failWith: Error | null = null

  seed(doc: Notebook, id = "f1") {
    this.file = { id, version: "1", doc: structuredClone(doc) }
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
    return structuredClone(this.file!.doc)
  }
  async write(id: string | undefined, doc: Notebook) {
    this.check()
    this.writes++
    const version = String(Number(this.file?.version ?? 0) + 1)
    this.file = { id: id ?? "f1", version, doc: structuredClone(doc) }
    return { id: this.file.id, version }
  }
  setToken() {}
}

const auth: DriveAuth = {
  getToken: async () => ({ value: "t", expiresAt: Date.now() + 3_600_000 }),
  clearToken: async () => {},
  login: async () => ({ value: "t", expiresAt: Date.now() + 3_600_000 }),
}

const topic = (id: string, name: string, updatedAt = "2026-10-01T00:00:00.000Z"): Topic => ({
  id,
  name,
  updatedAt,
  kind: "concept",
  color: "gray",
  order: 0,
})

/** A notebook holding these topics */
function nb(...topics: Topic[]): Notebook {
  const doc = emptyNotebook()
  for (const t of topics) doc.topics[t.id] = t
  return doc
}

function setup(local: Notebook, record: SyncRecord | null = null, base: Notebook | null = null) {
  const drive = new FakeDrive()
  const state = {
    local: structuredClone(local),
    record,
    base,
    statuses: [] as SyncState["status"][],
  }
  const sync = new DriveSync({
    readRecord: () => state.record,
    writeRecord: (r) => {
      state.record = r
    },
    readBase: () => state.base,
    writeBase: (doc) => {
      state.base = structuredClone(doc)
    },
    getDoc: () => state.local,
    applyRemote: (doc) => {
      state.local = doc
    },
    onState: (s) => state.statuses.push(s.status),
    createStore: () => drive,
  })
  return { drive, state, sync }
}

const synced = (state: { statuses: SyncState["status"][] }) =>
  vi.waitFor(() => expect(state.statuses.at(-1)).toBe("synced"))

describe("DriveSync", () => {
  it("creates the Drive file on the first sync when there is none, and keeps it as the base", async () => {
    const { drive, state, sync } = setup(nb(topic("a", "A")))
    sync.attach(auth)
    await synced(state)
    expect(drive.file?.doc).toEqual(nb(topic("a", "A")))
    expect(state.record).toEqual({ fileId: "f1", version: "1", pending: false })
    expect(state.base).toEqual(nb(topic("a", "A")))
  })

  it("first sync with an existing file: merges both, the newer edit wins, uploads the union", async () => {
    const { drive, state, sync } = setup(
      nb(topic("a", "local A", "2026-10-02T00:00:00.000Z"), topic("b", "B"))
    )
    drive.seed(nb(topic("a", "drive A", "2026-10-03T00:00:00.000Z"), topic("c", "C")))
    await sync.connect() // not attached yet: no-op
    sync.attach(auth)
    await synced(state)
    const expected = nb(
      topic("a", "drive A", "2026-10-03T00:00:00.000Z"),
      topic("b", "B"),
      topic("c", "C")
    )
    expect(state.local).toEqual(expected)
    expect(drive.file?.doc).toEqual(expected)
  })

  it("takes Drive's copy as is when this device has nothing pending", async () => {
    const { drive, state, sync } = setup(nb(topic("a", "old")), {
      fileId: "f1",
      version: "1",
      pending: false,
    })
    drive.seed(nb(topic("a", "from phone", "2026-10-05T00:00:00.000Z")))
    drive.file!.version = "2" // the other device wrote since
    sync.attach(auth)
    await synced(state)
    expect(state.local).toEqual(nb(topic("a", "from phone", "2026-10-05T00:00:00.000Z")))
    expect(drive.writes).toBe(0)
  })

  it("pending changes: merges against the base, so each side's own edits survive", async () => {
    const base = nb(topic("a", "A"), topic("b", "B"))
    // This device renamed a; the phone renamed b, with an older timestamp
    const local = nb(topic("a", "A typed offline", "2026-10-04T00:00:00.000Z"), topic("b", "B"))
    const { drive, state, sync } = setup(local, { fileId: "f1", version: "1", pending: true }, base)
    drive.seed(nb(topic("a", "A"), topic("b", "B from phone", "2026-10-02T00:00:00.000Z")))
    drive.file!.version = "2"
    sync.attach(auth)
    await synced(state)
    const expected = nb(
      topic("a", "A typed offline", "2026-10-04T00:00:00.000Z"),
      topic("b", "B from phone", "2026-10-02T00:00:00.000Z")
    )
    expect(state.local).toEqual(expected)
    expect(drive.file?.doc).toEqual(expected)
    expect(state.record?.pending).toBe(false)
    expect(state.base).toEqual(expected)
  })

  it("re-creates the file when it was deleted on Drive", async () => {
    const { drive, state, sync } = setup(nb(topic("a", "A")), {
      fileId: "gone",
      version: "5",
      pending: false,
    })
    sync.attach(auth)
    await synced(state)
    expect(drive.file?.doc).toEqual(nb(topic("a", "A")))
  })

  it("reports offline and needs-login without losing local data", async () => {
    const local = nb(topic("a", "A"))
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
      const { drive, state, sync } = setup(nb())
      sync.attach(auth)
      await synced(state)
      const writesAfterStart = drive.writes

      for (const name of ["a", "ab", "abc"]) {
        state.local = nb(topic("x", name))
        sync.notifyLocalChange()
      }
      expect(state.record?.pending).toBe(true)
      expect(drive.writes).toBe(writesAfterStart)

      await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
      await vi.waitFor(() => expect(state.record?.pending).toBe(false))
      expect(drive.writes).toBe(writesAfterStart + 1)
      expect(drive.file?.doc).toEqual(nb(topic("x", "abc")))
    })

    it("does not schedule uploads while waiting for sign-in", async () => {
      const { drive, state, sync } = setup(nb())
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
