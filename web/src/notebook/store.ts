import { create } from "zustand"
import type { Content } from "@/content/load"
import type { Lang } from "@/i18n/languages"
import { nowIso } from "@/lib/dates"
import { KEYS, storage } from "@/lib/storage"
import { newId, normalizeUrl, problemIdFor } from "@/notebook/ids"
import { getLive, liveValues, patternsOf, phasesOf, topicsOf } from "@/notebook/logic"
import { patternFromItem } from "@/notebook/migrate"
import { DEFAULT_TOPICS } from "@/notebook/templates"
import {
  COLLECTIONS,
  type Attempt,
  type Collection,
  type Entity,
  type EntityMap,
  type Grade,
  type Notebook,
  type Outcome,
  type Pattern,
  type Problem,
  type Resource,
  type ResourceKind,
  type Topic,
  type TopicColor,
  type TopicKind,
  emptyNotebook,
} from "@/notebook/schema"
import { sameNotebook } from "@/notebook/merge"

interface NotebookState {
  doc: Notebook
}

export const useNotebookStore = create<NotebookState>()(() => ({ doc: emptyNotebook() }))

// Drive sync listens here: every change made on this device marks the copy as not yet
// uploaded and schedules a save (see sync/engine.ts).
const localChangeListeners = new Set<() => void>()

export function onLocalNotebookChange(listener: () => void) {
  localChangeListeners.add(listener)
  return () => {
    localChangeListeners.delete(listener)
  }
}

function commit(doc: Notebook, { local }: { local: boolean }) {
  useNotebookStore.setState({ doc })
  storage.set(KEYS.notebook, doc)
  if (local) for (const listener of localChangeListeners) listener()
}

const current = () => useNotebookStore.getState().doc

// ---------------------------------------------------------------------------------------------
// Transactions: several entity changes, one commit (one save, one sync)

interface Tx {
  readonly doc: Notebook
  readonly now: string
  get<C extends Collection>(c: C, id: string | null | undefined): EntityMap[C] | undefined
  put<C extends Collection>(c: C, entity: EntityMap[C]): void
  patch<C extends Collection>(c: C, id: string, changes: Partial<EntityMap[C]>): void
}

type Maps = Record<Collection, Record<string, Entity>>

function transact<R>(fn: (tx: Tx) => R): R {
  const draft = { ...current() }
  const copied = new Set<Collection>()
  const now = nowIso()
  const maps = draft as unknown as Maps
  const tx: Tx = {
    doc: draft,
    now,
    get: (c, id) => (id ? (maps[c][id] as EntityMap[typeof c] | undefined) : undefined),
    put(c, entity) {
      const key: Collection = c
      if (!copied.has(key)) {
        maps[key] = { ...maps[key] }
        copied.add(key)
      }
      maps[key][entity.id] = entity
    },
    patch(c, id, changes) {
      const entity = tx.get(c, id)
      if (entity) tx.put(c, { ...entity, ...changes, updatedAt: now })
    },
  }
  const result = fn(tx)
  if (copied.size) commit(draft, { local: true })
  return result
}

const nextOrder = (list: { order: number }[]) =>
  list.reduce((max, x) => Math.max(max, x.order), -1) + 1

/** Gives `ids` the orders 0..n-1, touching only the entities whose order changes */
function reorder(tx: Tx, c: "topics" | "phases" | "patterns", ids: string[]) {
  ids.forEach((id, order) => {
    const entity = tx.get(c, id)
    if (entity && entity.order !== order) tx.patch(c, id, { order } as Partial<EntityMap[typeof c]>)
  })
}

const insertAt = (ids: string[], id: string, index: number) => {
  const rest = ids.filter((x) => x !== id)
  rest.splice(Math.max(0, Math.min(index, rest.length)), 0, id)
  return rest
}

const union = (a: string[], b: string[]) => [...new Set([...a, ...b])]

// ---------------------------------------------------------------------------------------------
// Deleting: marks entities deleted (see schema.ts); what only made sense inside goes too

function deletePatternIn(tx: Tx, id: string) {
  tx.patch("patterns", id, { deleted: true })
  for (const problem of liveValues(tx.doc.problems)) {
    if (!problem.patternIds.includes(id)) continue
    const patternIds = problem.patternIds.filter((p) => p !== id)
    const stillUsed = patternIds.some((p) => getLive(tx.doc.patterns, p))
    tx.patch("problems", problem.id, stillUsed ? { patternIds } : { patternIds, deleted: true })
  }
  for (const resource of liveValues(tx.doc.resources)) {
    if (!resource.patternIds.includes(id)) continue
    const patternIds = resource.patternIds.filter((p) => p !== id)
    const stillUsed = patternIds.some((p) => getLive(tx.doc.patterns, p))
    tx.patch("resources", resource.id, stillUsed ? { patternIds } : { patternIds, deleted: true })
  }
  for (const card of liveValues(tx.doc.cards)) {
    if (card.patternId === id) tx.patch("cards", card.id, { deleted: true })
  }
}

function addProblemIn(
  tx: Tx,
  input: { url: string; title: string; level?: string; patternIds: string[]; notes?: string }
): string {
  const id = problemIdFor(input.url)
  const existing = tx.get("problems", id)
  if (existing) {
    tx.patch("problems", id, {
      deleted: false,
      patternIds: union(existing.deleted ? [] : existing.patternIds, input.patternIds),
      title: existing.title || input.title,
      level: existing.level || (input.level ?? ""),
    })
  } else {
    tx.put("problems", {
      id,
      updatedAt: tx.now,
      url: input.url.trim(),
      title: input.title.trim() || input.url.trim(),
      level: input.level ?? "",
      patternIds: input.patternIds,
      notes: input.notes ?? "",
      createdAt: tx.now,
    })
  }
  return id
}

function addResourceIn(
  tx: Tx,
  input: { url: string; title: string; kind: ResourceKind; patternIds: string[]; takeaway?: string }
): string {
  const key = normalizeUrl(input.url)
  const existing = liveValues(tx.doc.resources).find((r) => normalizeUrl(r.url) === key)
  if (existing) {
    tx.patch("resources", existing.id, {
      patternIds: union(existing.patternIds, input.patternIds),
      takeaway: existing.takeaway || (input.takeaway ?? ""),
    })
    return existing.id
  }
  const id = newId("rs")
  tx.put("resources", {
    id,
    updatedAt: tx.now,
    url: input.url.trim(),
    title: input.title.trim() || input.url.trim(),
    kind: input.kind,
    patternIds: input.patternIds,
    takeaway: input.takeaway ?? "",
    createdAt: tx.now,
  })
  return id
}

/** Reads a field by path ("notes", "sections.idea") */
function readField(entity: Entity, field: string): string {
  const [head, key] = field.split(".")
  const value = (entity as Record<string, unknown>)[head ?? ""]
  if (key !== undefined) return ((value as Record<string, string> | undefined) ?? {})[key] ?? ""
  return typeof value === "string" ? value : ""
}

function writeField(entity: Entity, field: string, text: string): Partial<Entity> {
  const [head, key] = field.split(".")
  if (!head) return {}
  if (key !== undefined) {
    const record = ((entity as Record<string, unknown>)[head] as Record<string, string>) ?? {}
    return { [head]: { ...record, [key]: text } } as Partial<Entity>
  }
  return { [head]: text } as Partial<Entity>
}

// ---------------------------------------------------------------------------------------------
// Every change to the notebook goes through here

export const notebookActions = {
  get: current,

  /** Startup: the copy saved on this device */
  init(doc: Notebook) {
    useNotebookStore.setState({ doc })
  },

  /**
   * Import from a file. What this notebook has and the file does not is marked deleted rather
   * than left out: left out, the next sync would bring it back from Drive.
   */
  replace(doc: Notebook) {
    const now = nowIso()
    const before = current() as unknown as Maps
    const next = { ...doc } as unknown as Maps
    for (const c of COLLECTIONS) {
      const gone = Object.values(before[c]).filter((e) => !next[c][e.id] && !e.deleted)
      if (!gone.length) continue
      next[c] = { ...next[c] }
      for (const e of gone) next[c][e.id] = { ...e, deleted: true, updatedAt: now }
    }
    commit(next as unknown as Notebook, { local: true })
  },

  /** Start over: everything is marked deleted, except the default topics, which stay empty */
  resetAll() {
    transact((tx) => {
      const maps = tx.doc as unknown as Maps
      for (const c of COLLECTIONS) {
        for (const e of Object.values(maps[c])) {
          const isDefaultTopic = c === "topics" && DEFAULT_TOPICS.some((d) => d.id === e.id)
          if (isDefaultTopic && e.deleted) tx.patch(c, e.id, { deleted: false })
          else if (!isDefaultTopic && !e.deleted) tx.patch(c, e.id, { deleted: true })
        }
      }
    })
  },

  /** A copy merged with Drive's: replaces this one without counting as a new change */
  applyRemote(doc: Notebook) {
    if (!sameNotebook(doc, current())) commit(doc, { local: false })
  },

  // Topics -----------------------------------------------------------------------------------

  addTopic(name: string, kind: TopicKind, color: TopicColor): string {
    return transact((tx) => {
      const id = newId("tp")
      tx.put("topics", {
        id,
        updatedAt: tx.now,
        name: name.trim(),
        kind,
        color,
        order: nextOrder(topicsOf(tx.doc)),
      })
      return id
    })
  },

  updateTopic(id: string, changes: Partial<Pick<Topic, "name" | "kind" | "color">>) {
    transact((tx) => tx.patch("topics", id, changes))
  },

  deleteTopic(id: string) {
    transact((tx) => {
      tx.patch("topics", id, { deleted: true })
      for (const phase of phasesOf(tx.doc, id)) tx.patch("phases", phase.id, { deleted: true })
      for (const pattern of liveValues(tx.doc.patterns)) {
        if (pattern.topicId === id) deletePatternIn(tx, pattern.id)
      }
    })
  },

  moveTopic(id: string, index: number) {
    transact((tx) =>
      reorder(
        tx,
        "topics",
        insertAt(
          topicsOf(tx.doc).map((t) => t.id),
          id,
          index
        )
      )
    )
  },

  // Phases -----------------------------------------------------------------------------------

  addPhase(topicId: string, name: string): string {
    return transact((tx) => {
      const id = newId("ph")
      tx.put("phases", {
        id,
        updatedAt: tx.now,
        topicId,
        name: name.trim(),
        order: nextOrder(phasesOf(tx.doc, topicId)),
      })
      return id
    })
  },

  renamePhase(id: string, name: string) {
    transact((tx) => tx.patch("phases", id, { name: name.trim() }))
  },

  /** Its patterns stay, directly under the topic */
  deletePhase(id: string) {
    transact((tx) => {
      tx.patch("phases", id, { deleted: true })
      for (const pattern of liveValues(tx.doc.patterns)) {
        if (pattern.phaseId === id) tx.patch("patterns", pattern.id, { phaseId: null })
      }
    })
  },

  movePhase(id: string, index: number) {
    transact((tx) => {
      const phase = tx.get("phases", id)
      if (!phase) return
      const ids = phasesOf(tx.doc, phase.topicId).map((p) => p.id)
      reorder(tx, "phases", insertAt(ids, id, index))
    })
  },

  // Patterns ---------------------------------------------------------------------------------

  addPattern(
    topicId: string,
    phaseId: string | null,
    name: string,
    { theory = false }: { theory?: boolean } = {}
  ): string {
    return transact((tx) => {
      const id = newId("pt")
      tx.put("patterns", {
        id,
        updatedAt: tx.now,
        topicId,
        phaseId,
        name: name.trim(),
        order: nextOrder(patternsOf(tx.doc, topicId, phaseId)),
        theory,
        sections: {},
        requires: [],
        related: [],
        createdAt: tx.now,
      })
      return id
    })
  },

  /** A pattern made from an item of the old roadmap (with its phase when that is missing) */
  addSuggestedPattern(content: Content, itemId: string, lang: Lang): string | null {
    return notebookActions.addSuggestedPatterns(content, [itemId], lang)[0] ?? null
  },

  /**
   * "Add all": several suggested items in one change (one save, one upload).
   * Returns the patterns that were not in the notebook before, for Undo.
   */
  addSuggestedPatterns(content: Content, itemIds: string[], lang: Lang): string[] {
    return transact((tx) => {
      const added: string[] = []
      for (const itemId of itemIds) {
        const made = patternFromItem(content, itemId, lang, tx.now)
        if (!made) continue
        const phase = tx.get("phases", made.phase.id)
        if (!phase) tx.put("phases", made.phase)
        else if (phase.deleted) tx.patch("phases", phase.id, { deleted: false })
        const pattern = tx.get("patterns", made.pattern.id)
        if (!pattern) tx.put("patterns", made.pattern)
        else if (pattern.deleted) tx.patch("patterns", pattern.id, { deleted: false })
        else continue
        added.push(made.pattern.id)
      }
      return added
    })
  },

  /** Undo of "Add all": the patterns it added are still empty, so nothing is lost */
  deletePatterns(ids: string[]) {
    transact((tx) => {
      for (const id of ids) deletePatternIn(tx, id)
    })
  },

  updatePattern(
    id: string,
    changes: Partial<Pick<Pattern, "name" | "theory" | "done" | "requires" | "related">>
  ) {
    transact((tx) => tx.patch("patterns", id, changes))
  },

  setSection(id: string, key: string, text: string) {
    transact((tx) => {
      const pattern = tx.get("patterns", id)
      if (pattern) tx.patch("patterns", id, { sections: { ...pattern.sections, [key]: text } })
    })
  },

  deletePattern(id: string) {
    transact((tx) => deletePatternIn(tx, id))
  },

  /** Drag and drop in the tree: into a phase (or straight under a topic) at a position */
  movePattern(id: string, topicId: string, phaseId: string | null, index: number) {
    transact((tx) => {
      const pattern = tx.get("patterns", id)
      if (!pattern) return
      if (pattern.topicId !== topicId || pattern.phaseId !== phaseId) {
        tx.patch("patterns", id, { topicId, phaseId })
      }
      const ids = patternsOf(tx.doc, topicId, phaseId).map((p) => p.id)
      reorder(tx, "patterns", insertAt(ids, id, index))
    })
  },

  // Problems and attempts --------------------------------------------------------------------

  /** The same link twice is one problem: it is linked to the new pattern instead */
  addProblem(input: {
    url: string
    title: string
    level?: string
    patternIds: string[]
    notes?: string
  }): string {
    return transact((tx) => addProblemIn(tx, input))
  },

  /** "Add all" suggested problems to one pattern, in one change */
  addProblems(
    inputs: { url: string; title: string; level?: string; patternIds: string[] }[]
  ): string[] {
    return transact((tx) => inputs.map((input) => addProblemIn(tx, input)))
  },

  /** Undo of "Add all": out of the pattern again (deleted when in no other pattern) */
  unlinkProblems(ids: string[], patternId: string) {
    for (const id of ids) notebookActions.unlinkProblem(id, patternId)
  },

  updateProblem(id: string, changes: Partial<Pick<Problem, "title" | "url" | "level" | "notes">>) {
    transact((tx) => tx.patch("problems", id, changes))
  },

  linkProblem(id: string, patternId: string) {
    transact((tx) => {
      const problem = tx.get("problems", id)
      if (problem) tx.patch("problems", id, { patternIds: union(problem.patternIds, [patternId]) })
    })
  },

  /** Out of one pattern; deleted when it is in no pattern any more */
  unlinkProblem(id: string, patternId: string) {
    transact((tx) => {
      const problem = tx.get("problems", id)
      if (!problem) return
      const patternIds = problem.patternIds.filter((p) => p !== patternId)
      const stillUsed = patternIds.some((p) => getLive(tx.doc.patterns, p))
      tx.patch("problems", id, stillUsed ? { patternIds } : { patternIds, deleted: true })
    })
  },

  deleteProblem(id: string) {
    transact((tx) => tx.patch("problems", id, { deleted: true }))
  },

  logAttempt(
    problemId: string,
    input: {
      outcome: Outcome
      minutes: number | null
      mistakes: string[]
      note: string
      code: string
      lang: string
    }
  ): string {
    return transact((tx) => {
      const id = newId("at")
      tx.put("attempts", { id, updatedAt: tx.now, problemId, at: tx.now, ...input })
      // Touch the problem too: "recently worked on" sorts by it
      tx.patch("problems", problemId, {})
      return id
    })
  },

  updateAttempt(
    id: string,
    changes: Partial<Pick<Attempt, "outcome" | "minutes" | "mistakes" | "note" | "code" | "lang">>
  ) {
    transact((tx) => tx.patch("attempts", id, changes))
  },

  deleteAttempt(id: string) {
    transact((tx) => tx.patch("attempts", id, { deleted: true }))
  },

  // Resources --------------------------------------------------------------------------------

  addResource(input: {
    url: string
    title: string
    kind: ResourceKind
    patternIds: string[]
    takeaway?: string
  }): string {
    return transact((tx) => addResourceIn(tx, input))
  },

  addResources(
    inputs: { url: string; title: string; kind: ResourceKind; patternIds: string[] }[]
  ): string[] {
    return transact((tx) => inputs.map((input) => addResourceIn(tx, input)))
  },

  unlinkResources(ids: string[], patternId: string) {
    for (const id of ids) notebookActions.unlinkResource(id, patternId)
  },

  updateResource(
    id: string,
    changes: Partial<Pick<Resource, "title" | "url" | "kind" | "takeaway">>
  ) {
    transact((tx) => tx.patch("resources", id, changes))
  },

  unlinkResource(id: string, patternId: string) {
    transact((tx) => {
      const resource = tx.get("resources", id)
      if (!resource) return
      const patternIds = resource.patternIds.filter((p) => p !== patternId)
      const stillUsed = patternIds.some((p) => getLive(tx.doc.patterns, p))
      tx.patch("resources", id, stillUsed ? { patternIds } : { patternIds, deleted: true })
    })
  },

  // Cards ------------------------------------------------------------------------------------

  addCard(patternId: string, question: string, answer: string): string {
    return transact((tx) => {
      const id = newId("cd")
      tx.put("cards", {
        id,
        updatedAt: tx.now,
        patternId,
        question,
        answer,
        reviews: [],
        createdAt: tx.now,
      })
      return id
    })
  },

  updateCard(id: string, changes: { question?: string; answer?: string }) {
    transact((tx) => tx.patch("cards", id, changes))
  },

  gradeCard(id: string, grade: Grade) {
    transact((tx) => {
      const card = tx.get("cards", id)
      if (card) tx.patch("cards", id, { reviews: [...card.reviews, { at: tx.now, grade }] })
    })
  },

  deleteCard(id: string) {
    transact((tx) => tx.patch("cards", id, { deleted: true }))
  },

  // Inbox ------------------------------------------------------------------------------------

  addInbox(url: string, title = "", note = ""): string {
    return transact((tx) => {
      const id = newId("ib")
      tx.put("inbox", {
        id,
        updatedAt: tx.now,
        url: url.trim(),
        title: title.trim(),
        note,
        createdAt: tx.now,
      })
      return id
    })
  },

  fileAsProblem(
    inboxId: string,
    input: { url: string; title: string; level: string; patternIds: string[] }
  ): string {
    return transact((tx) => {
      const note = tx.get("inbox", inboxId)?.note ?? ""
      const id = addProblemIn(tx, { ...input, notes: note })
      tx.patch("inbox", inboxId, { deleted: true })
      return id
    })
  },

  fileAsResource(
    inboxId: string,
    input: { url: string; title: string; kind: ResourceKind; patternIds: string[] }
  ): string {
    return transact((tx) => {
      const note = tx.get("inbox", inboxId)?.note ?? ""
      const id = addResourceIn(tx, { ...input, takeaway: note })
      tx.patch("inbox", inboxId, { deleted: true })
      return id
    })
  },

  deleteInbox(id: string) {
    transact((tx) => tx.patch("inbox", id, { deleted: true }))
  },

  // Conflicts --------------------------------------------------------------------------------

  dismissConflict(id: string) {
    transact((tx) => tx.patch("conflicts", id, { deleted: true }))
  },

  /** Puts the kept text back; the text it replaces is kept in its place, so nothing is lost */
  restoreConflict(id: string) {
    transact((tx) => {
      const conflict = tx.get("conflicts", id)
      if (!conflict) return
      const entity = tx.get(conflict.collection, conflict.entityId)
      if (!entity) return
      const replaced = readField(entity, conflict.field)
      tx.patch(
        conflict.collection,
        conflict.entityId,
        writeField(entity, conflict.field, conflict.text)
      )
      tx.patch(
        "conflicts",
        id,
        replaced.trim() ? { text: replaced, at: tx.now } : { deleted: true }
      )
    })
  },
}

export type NotebookActions = typeof notebookActions
