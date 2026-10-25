import { create } from "zustand"
import { KEYS, storage } from "@/lib/storage"
import { emptyProgress, itemProgress, nowIso, sameProgress } from "@/progress/logic"
import type { ItemProgress, Progress } from "@/progress/schema"

interface ProgressState {
  progress: Progress
}

export const useProgressStore = create<ProgressState>()(() => ({ progress: emptyProgress() }))

// Drive sync listens here: every change made on this device marks the copy as not yet
// uploaded and schedules a save (see sync/engine.ts).
const localChangeListeners = new Set<() => void>()

export function onLocalProgressChange(listener: () => void) {
  localChangeListeners.add(listener)
  return () => {
    localChangeListeners.delete(listener)
  }
}

function commit(progress: Progress, { local }: { local: boolean }) {
  useProgressStore.setState({ progress })
  storage.set(KEYS.progress, progress)
  if (local) for (const listener of localChangeListeners) listener()
}

const current = () => useProgressStore.getState().progress

function updateItem(id: string, changes: Partial<ItemProgress>) {
  const progress = current()
  commit(
    { ...progress, items: { ...progress.items, [id]: { ...itemProgress(progress, id), ...changes } } },
    { local: true }
  )
}

// Every change to progress (tick, solve, notes, code, review, import, reset) goes through here
export const progressActions = {
  get: current,

  /** Startup: the copy saved on this device */
  init(progress: Progress) {
    useProgressStore.setState({ progress })
  },

  updateItem,

  setDone(id: string, done: boolean) {
    updateItem(id, { done, doneAt: done ? nowIso() : undefined })
  },

  setCheck(id: string, checkId: string, checked: boolean) {
    updateItem(id, { checks: { ...itemProgress(current(), id).checks, [checkId]: checked } })
  },

  markReviewed(id: string) {
    updateItem(id, { reviews: [...(itemProgress(current(), id).reviews ?? []), nowIso()] })
  },

  setSolved(url: string, solved: boolean) {
    const rest = { ...current().solved }
    delete rest[url]
    commit({ ...current(), solved: solved ? { ...rest, [url]: nowIso() } : rest }, { local: true })
  },

  /** Import from a file, or start over */
  replace(progress: Progress) {
    commit(progress, { local: true })
  },

  /** A copy downloaded from Drive: replaces this one without counting as a new change */
  applyRemote(progress: Progress) {
    if (!sameProgress(progress, current())) commit(progress, { local: false })
  },
}
