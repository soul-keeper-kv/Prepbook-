import { create } from "zustand"
import { KEYS, storage } from "@/lib/storage"
import { parseNotebook } from "@/notebook/schema"
import { notebookActions, onLocalNotebookChange } from "@/notebook/store"
import { detectAuth } from "@/sync/auth"
import { DriveSync, type SyncRecord, type SyncState } from "@/sync/engine"

// The one DriveSync instance, wired to the notebook store and to the page lifecycle.

export const useSyncStore = create<SyncState>()(() => ({
  status: "off",
  error: null,
  syncedAt: null,
}))

export const driveSync = new DriveSync({
  readRecord: () => (storage.get(KEYS.notebookSync) as SyncRecord | null) ?? null,
  writeRecord: (record) => storage.set(KEYS.notebookSync, record),
  readBase: () => parseNotebook(storage.get(KEYS.notebookBase)),
  writeBase: (doc) => storage.set(KEYS.notebookBase, doc),
  getDoc: notebookActions.get,
  applyRemote: notebookActions.applyRemote,
  onState: (state) => useSyncStore.setState(state),
})

onLocalNotebookChange(() => driveSync.notifyLocalChange())

/** Call once at startup */
export async function startDriveSync() {
  // Back to the app (maybe after studying on the other device): fetch the newest copy.
  // Leaving it: upload the change that is waiting for its timer.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" || driveSync.hasPendingSave) driveSync.autoSync()
  })
  window.addEventListener("online", () => driveSync.autoSync())

  const found = await detectAuth()
  if (!found) return
  if (!found.configured) driveSync.markSetup()
  else driveSync.attach(found.auth)
}
