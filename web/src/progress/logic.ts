import type { Item } from "@/content/schema"
import type { ItemProgress, Progress } from "@/progress/schema"

export const REVIEW_AFTER_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000
const NO_PROGRESS: ItemProgress = {}

export const emptyProgress = (): Progress => ({ items: {}, solved: {} })
export const nowIso = () => new Date().toISOString()

export const itemProgress = (progress: Progress, id: string): ItemProgress =>
  progress.items[id] ?? NO_PROGRESS

export const isDone = (progress: Progress, id: string) => Boolean(progress.items[id]?.done)
export const isSolved = (progress: Progress, url: string) => Boolean(progress.solved[url])

export const solvedCount = (progress: Progress, item: Item) =>
  (item.problems ?? []).filter((p) => isSolved(progress, p.url)).length

export const daysSince = (iso: string, now = Date.now()) =>
  Math.floor((now - new Date(iso).getTime()) / DAY_MS)

export const isToday = (iso: string, now = new Date()) =>
  new Date(iso).toDateString() === now.toDateString()

/** Last review, or the day it was ticked done */
export const lastStudied = (p: ItemProgress): string | undefined => p.reviews?.at(-1) || p.doneAt

/** Done, and not studied for REVIEW_AFTER_DAYS days */
export function needsReview(progress: Progress, id: string, now = Date.now()): boolean {
  const p = itemProgress(progress, id)
  const last = lastStudied(p)
  if (!p.done || !last) return false
  return daysSince(last, now) >= REVIEW_AFTER_DAYS
}

/**
 * Merges two copies of the progress: every item from both is kept, and `winner` wins
 * when both have the same field of the same item.
 */
export function mergeProgress(base: Progress, winner: Progress): Progress {
  const items = { ...base.items }
  for (const [id, p] of Object.entries(winner.items)) items[id] = { ...items[id], ...p }
  return { items, solved: { ...base.solved, ...winner.solved } }
}

/** JSON-like copy with sorted keys and no undefined fields, so key order does not matter */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value === null || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => [k, canonical(v)])
  )
}

/** Same content, whatever the key order (edits append keys; parsing reorders them) */
export const sameProgress = (a: Progress, b: Progress) =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
