import type { Phase } from "@/content/schema"
import { nowIso } from "@/lib/dates"
import { KEYS, storage } from "@/lib/storage"
import { ProgressSchema, type Progress } from "@/progress/schema"

// Progress the old roadmap app saved in this browser, read once to carry it into the
// notebook (see notebook/load.ts). Copies saved before v3 only held ticks: v2 by item id,
// v1 by "phaseIndex-itemIndex". They are converted here; nothing is written back.
export function loadSavedProgress(phases: Phase[]): Progress {
  const saved = ProgressSchema.safeParse(storage.get(KEYS.progress))
  if (saved.success) return saved.data

  const v2 = storage.get(KEYS.legacyV2)
  const v1 = storage.get(KEYS.legacyV1)
  const doneIds: string[] = []
  if (v2 && typeof v2 === "object") {
    for (const [id, done] of Object.entries(v2)) if (done) doneIds.push(id)
  }
  if (!doneIds.length && v1 && typeof v1 === "object") {
    for (const [key, done] of Object.entries(v1)) {
      const [pi, ii] = key.split("-").map(Number)
      const item = phases[pi ?? -1]?.items[ii ?? -1]
      if (done && item) doneIds.push(item.id)
    }
  }

  const progress: Progress = { items: {}, solved: {} }
  for (const id of doneIds) progress.items[id] = { done: true, doneAt: nowIso() }
  return progress
}
