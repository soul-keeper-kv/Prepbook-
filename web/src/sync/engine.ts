import { mergeProgress, nowIso, sameProgress } from "@/progress/logic"
import type { Progress } from "@/progress/schema"
import {
  NeedLogin,
  Offline,
  createDriveStore,
  type DriveAuth,
  type DriveStore,
} from "@/sync/drive-store"

// Keeps the progress on this device and the file on Google Drive in step.
// localStorage always holds a full copy, so the app works offline or before connecting.
//
// The sync record (localStorage dsa_drive_sync) = { fileId, version, pending }:
//   no fileId          never synced with this file -> merge with it, Drive wins on conflicts
//   pending: false     same as Drive `version`     -> Drive has newer? take Drive's copy as is
//   pending: true      changes not uploaded yet    -> merge, this device wins, then upload

export type SyncStatus = "off" | "setup" | "login" | "syncing" | "synced" | "offline" | "error"

export interface SyncState {
  status: SyncStatus
  error: unknown
  syncedAt: string | null
}

export interface SyncRecord {
  fileId?: string
  version?: string
  pending?: boolean
}

export interface SyncDeps {
  readRecord(): SyncRecord | null
  writeRecord(record: SyncRecord): void
  getProgress(): Progress
  /** Replace the local copy without counting it as a new local change */
  applyRemote(progress: Progress): void
  onState(state: SyncState): void
  createStore?: (auth: DriveAuth) => DriveStore
}

export const SAVE_DELAY_MS = 1500 // one upload for a burst of keystrokes

export class DriveSync {
  private readonly deps: SyncDeps
  private auth: DriveAuth | null = null
  private store: DriveStore | null = null
  private state: SyncState = { status: "off", error: null, syncedAt: null }
  private version = 0 // bumped on every local change
  private timer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private again = false // a sync was asked for while one was running

  constructor(deps: SyncDeps) {
    this.deps = deps
  }

  get status() {
    return this.state.status
  }

  get hasPendingSave() {
    return this.timer !== null
  }

  /** Start syncing with this way of getting tokens */
  attach(auth: DriveAuth) {
    this.auth = auth
    this.store = (this.deps.createStore ?? createDriveStore)(auth)
    void this.sync()
  }

  /** Drive is reachable from here, but the OAuth client is not set up yet */
  markSetup() {
    this.setState({ status: "setup", error: null })
  }

  /** Called on every change made on this device */
  notifyLocalChange() {
    this.version++
    // Remember that something is not uploaded yet, so an older Drive copy cannot overwrite it
    // on the next start
    this.deps.writeRecord({ ...this.deps.readRecord(), pending: true })
    this.queueSave()
  }

  queueSave() {
    if (!this.store || this.state.status === "login") return // wait for "Connect Google Drive"
    this.clearTimer()
    this.timer = setTimeout(() => void this.sync(), SAVE_DELAY_MS)
  }

  /** Coming back to the app, or back online */
  autoSync() {
    if (this.store && this.state.status !== "login") void this.sync()
  }

  /** The "Connect Google Drive" / "Sync again" button */
  async connect() {
    if (!this.auth || !this.store) return
    if (this.state.status !== "login") {
      await this.sync()
      return
    }
    try {
      const token = await this.auth.login()
      if (token) this.store.setToken(token)
      await this.sync()
    } catch (err) {
      if (!(err instanceof NeedLogin)) this.setState({ status: "error", error: err })
    }
  }

  /** One sync at a time; a request during a sync runs right after it */
  async sync(): Promise<void> {
    this.clearTimer()
    const store = this.store
    if (!store) return
    if (this.running) {
      this.again = true
      return
    }
    this.running = true
    this.setState({ status: "syncing", error: null })
    try {
      const saved = this.deps.readRecord()
      let file = (saved?.fileId && (await store.getFile(saved.fileId))) || (await store.findFile())
      const known = Boolean(file) && file?.id === saved?.fileId // synced with this very file before
      let mustWrite: boolean

      if (file && (!known || file.version !== saved?.version)) {
        // Drive has another copy than the one this device is based on: another device wrote it,
        // or this is the first sync
        const remote = await store.download(file.id)
        // Read the flag again after the download: a change may have come in meanwhile
        const pending = this.deps.readRecord()?.pending
        const local = this.deps.getProgress()
        const merged = !known
          ? mergeProgress(local, remote)
          : pending
            ? mergeProgress(remote, local)
            : remote
        this.deps.applyRemote(merged)
        mustWrite = !sameProgress(merged, remote)
      } else {
        mustWrite = !file || Boolean(this.deps.readRecord()?.pending)
      }

      const version = this.version
      if (mustWrite || !file) file = await store.write(file?.id, this.deps.getProgress())
      // A change made during the upload keeps `pending`; the save it scheduled uploads it
      this.deps.writeRecord({
        fileId: file.id,
        version: file.version,
        pending: this.version !== version,
      })
      this.setState({ status: "synced", error: null, syncedAt: nowIso() })
    } catch (err) {
      if (err instanceof NeedLogin) {
        store.setToken(null)
        this.setState({ status: "login", error: null })
      } else if (err instanceof Offline) {
        this.setState({ status: "offline", error: null })
      } else {
        this.setState({ status: "error", error: err })
      }
    } finally {
      this.running = false
      if (this.again) {
        this.again = false
        void this.sync()
      }
    }
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  private setState(next: Partial<SyncState>) {
    this.state = { ...this.state, ...next }
    this.deps.onState(this.state)
  }
}
