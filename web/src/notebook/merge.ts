import { canonicalJson, deepEqual } from "@/lib/canonical"
import { hashId } from "@/notebook/ids"
import {
  COLLECTIONS,
  type Collection,
  type Conflict,
  type Entity,
  type Notebook,
} from "@/notebook/schema"

// Merges this device's notebook with the copy on Drive, field by field, against `base`: the
// copy both started from (the last one this device synced).
//
//   only one side changed a field  -> take that side
//   both changed it differently    -> the side whose entity was edited last wins; when the
//                                     field is a long text, the losing text is kept as a
//                                     Conflict so the user can pick it back
//
// Without a base (first sync with a file) every difference counts as "both changed".
// A pattern's sections are merged one by one: notes edited on the phone and the template
// edited on the PC both survive.

/** Fields holding text the user wrote at length: never dropped silently */
const TEXT_FIELDS: Partial<Record<Collection, ReadonlySet<string>>> = {
  problems: new Set(["notes"]),
  attempts: new Set(["note", "code"]),
  resources: new Set(["takeaway"]),
  cards: new Set(["question", "answer"]),
  inbox: new Set(["note"]),
}

type Fields = Record<string, unknown>
type OnLoss = (field: string, text: string) => void

function mergeField(
  base: unknown,
  hasBase: boolean,
  local: unknown,
  remote: unknown,
  localWins: boolean,
  onLoss?: (text: string) => void
): unknown {
  if (deepEqual(local, remote)) return local
  if (hasBase && deepEqual(local, base)) return remote
  if (hasBase && deepEqual(remote, base)) return local
  const [winner, loser] = localWins ? [local, remote] : [remote, local]
  if (onLoss && typeof loser === "string" && loser.trim() && loser !== winner) onLoss(loser)
  return winner
}

function mergeRecord(
  base: Fields | undefined,
  local: Fields,
  remote: Fields,
  localWins: boolean,
  onLoss?: (key: string, text: string) => void
): Fields {
  const out: Fields = {}
  for (const key of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    const value = mergeField(
      base?.[key],
      base !== undefined,
      local[key],
      remote[key],
      localWins,
      onLoss && ((text) => onLoss(key, text))
    )
    if (value !== undefined) out[key] = value
  }
  return out
}

function mergeEntity(
  collection: Collection,
  base: Entity | undefined,
  local: Entity | undefined,
  remote: Entity | undefined,
  onLoss: OnLoss
): Entity | undefined {
  if (!local) return remote
  if (!remote || deepEqual(local, remote)) return local

  // Same updatedAt on both (entities created alike on two devices): any fixed choice will do,
  // as long as both devices make the same one
  const localWins =
    local.updatedAt !== remote.updatedAt
      ? local.updatedAt > remote.updatedAt
      : canonicalJson(local) >= canonicalJson(remote)
  const b = base as Fields | undefined
  const l = local as unknown as Fields
  const r = remote as unknown as Fields
  const textFields = TEXT_FIELDS[collection]
  const out: Fields = {}

  for (const key of new Set([...Object.keys(l), ...Object.keys(r)])) {
    if (key === "updatedAt") continue
    if (collection === "patterns" && key === "sections") {
      out[key] = mergeRecord(
        (b?.[key] as Fields | undefined) ?? (b ? {} : undefined),
        (l[key] as Fields | undefined) ?? {},
        (r[key] as Fields | undefined) ?? {},
        localWins,
        (section, text) => onLoss(`sections.${section}`, text)
      )
      continue
    }
    const value = mergeField(
      b?.[key],
      b !== undefined,
      l[key],
      r[key],
      localWins,
      textFields?.has(key) ? (text) => onLoss(key, text) : undefined
    )
    if (value !== undefined) out[key] = value
  }
  out.updatedAt = local.updatedAt > remote.updatedAt ? local.updatedAt : remote.updatedAt
  return out as unknown as Entity
}

export function mergeNotebooks(base: Notebook | null, local: Notebook, remote: Notebook): Notebook {
  const out = { v: 1 } as Notebook
  const lost: Conflict[] = []

  for (const collection of COLLECTIONS) {
    const l = local[collection] as Record<string, Entity>
    const r = remote[collection] as Record<string, Entity>
    const b = (base?.[collection] ?? {}) as Record<string, Entity>
    const merged: Record<string, Entity> = {}

    for (const id of new Set([...Object.keys(l), ...Object.keys(r)])) {
      const loser = (field: string, text: string) => {
        // The id comes from the content, so both devices make the same Conflict, once
        const at = [l[id]?.updatedAt ?? "", r[id]?.updatedAt ?? ""].sort()[0] ?? ""
        lost.push({
          id: hashId("cf", `${collection}|${id}|${field}|${text}`),
          updatedAt: at,
          collection,
          entityId: id,
          field,
          text,
          at,
        })
      }
      const entity = mergeEntity(collection, b[id], l[id], r[id], loser)
      if (entity) merged[id] = entity
    }
    ;(out as Record<Collection, Record<string, Entity>>)[collection] = merged
  }

  for (const conflict of lost) {
    // Already there (maybe dismissed): leave it as it is
    if (!out.conflicts[conflict.id]) out.conflicts[conflict.id] = conflict
  }
  return out
}

export const sameNotebook = (a: Notebook, b: Notebook) => deepEqual(a, b)
