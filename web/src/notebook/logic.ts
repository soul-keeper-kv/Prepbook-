import { addDays, dayKey, daysBetween, startOfDay } from "@/lib/dates"
import type {
  Attempt,
  Card,
  Grade,
  Notebook,
  Outcome,
  Pattern,
  Phase,
  Problem,
  Resource,
  Topic,
} from "@/notebook/schema"

// Everything derived from the notebook: lists in display order, when a problem or card is due
// again, a pattern's level, today's tasks, the streak. Nothing here is stored: progress is
// worked out from what the user did, never ticked by hand (except theory patterns).

/** "Got it": this many problems solved on my own */
export const GOT_IT_PROBLEMS = 3
/** A redo counts as a review when it is at least this many days after the first try */
export const REVIEW_GAP_DAYS = 7
/** Overdue longer than this drops a pattern one level */
export const DROP_AFTER_DAYS = 7
/** Redo after this many days, by how the last attempt went */
export const REDO_AFTER: Record<Exclude<Outcome, "alone">, number> = { solution: 1, hint: 3 }
/** Solved alone again and again: wait longer each time */
export const GROWING_STEPS = [7, 14, 30, 60, 120]
export const CARD_AFTER: Record<Exclude<Grade, "solid">, number> = { forgot: 1, fuzzy: 3 }
/** Minutes a problem is expected to take when it has never been timed */
export const DEFAULT_PROBLEM_MINUTES = 25
export const MINUTES_PER_CARD = 2

export type Level = 0 | 1 | 2 | 3

// ---------------------------------------------------------------------------------------------
// Lists

type Live = { deleted?: boolean }
const isLive = <T extends Live>(entity: T | undefined): entity is T =>
  Boolean(entity && !entity.deleted)

export const liveValues = <T extends Live>(map: Record<string, T>): T[] =>
  Object.values(map).filter(isLive)

export const getLive = <T extends Live>(map: Record<string, T>, id: string | null | undefined) =>
  id && isLive(map[id]) ? map[id] : undefined

const byOrder = (a: { order: number; id: string }, b: { order: number; id: string }) =>
  a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
const byCreated = (a: { createdAt: string }, b: { createdAt: string }) =>
  a.createdAt.localeCompare(b.createdAt)

export const topicsOf = (nb: Notebook): Topic[] => liveValues(nb.topics).sort(byOrder)

export const phasesOf = (nb: Notebook, topicId: string): Phase[] =>
  liveValues(nb.phases)
    .filter((p) => p.topicId === topicId)
    .sort(byOrder)

/** The phase a pattern shows under; null when it has none, or its phase was deleted or moved */
export function phaseOfPattern(nb: Notebook, pattern: Pattern): string | null {
  const phase = getLive(nb.phases, pattern.phaseId)
  return phase && phase.topicId === pattern.topicId ? phase.id : null
}

export const patternsOf = (nb: Notebook, topicId: string, phaseId: string | null): Pattern[] =>
  liveValues(nb.patterns)
    .filter((p) => p.topicId === topicId && phaseOfPattern(nb, p) === phaseId)
    .sort(byOrder)

/** A topic's patterns in roadmap order: phase by phase, then those in no phase */
export const patternsOfTopic = (nb: Notebook, topicId: string): Pattern[] => [
  ...phasesOf(nb, topicId).flatMap((phase) => patternsOf(nb, topicId, phase.id)),
  ...patternsOf(nb, topicId, null),
]

export const inboxOf = (nb: Notebook) =>
  liveValues(nb.inbox).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

export const conflictsOf = (nb: Notebook, entityId?: string) =>
  liveValues(nb.conflicts).filter((c) => !entityId || c.entityId === entityId)

// Lookups by pattern / problem, built once per version of the notebook
interface NotebookIndex {
  attempts: Map<string, Attempt[]>
  problems: Map<string, Problem[]>
  resources: Map<string, Resource[]>
  cards: Map<string, Card[]>
}

const indexCache = new WeakMap<Notebook, NotebookIndex>()

function push<T>(map: Map<string, T[]>, key: string, value: T) {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

export function indexOf(nb: Notebook): NotebookIndex {
  const cached = indexCache.get(nb)
  if (cached) return cached
  const index: NotebookIndex = {
    attempts: new Map(),
    problems: new Map(),
    resources: new Map(),
    cards: new Map(),
  }
  for (const a of liveValues(nb.attempts).sort((x, y) => x.at.localeCompare(y.at))) {
    push(index.attempts, a.problemId, a)
  }
  for (const p of liveValues(nb.problems).sort(byCreated)) {
    for (const id of new Set(p.patternIds)) push(index.problems, id, p)
  }
  for (const r of liveValues(nb.resources).sort(byCreated)) {
    for (const id of new Set(r.patternIds)) push(index.resources, id, r)
  }
  for (const c of liveValues(nb.cards).sort(byCreated)) push(index.cards, c.patternId, c)
  indexCache.set(nb, index)
  return index
}

export const attemptsOf = (nb: Notebook, problemId: string) =>
  indexOf(nb).attempts.get(problemId) ?? []
export const problemsOf = (nb: Notebook, patternId: string) =>
  indexOf(nb).problems.get(patternId) ?? []
export const resourcesOf = (nb: Notebook, patternId: string) =>
  indexOf(nb).resources.get(patternId) ?? []
export const cardsOf = (nb: Notebook, patternId: string) => indexOf(nb).cards.get(patternId) ?? []

// ---------------------------------------------------------------------------------------------
// When to redo a problem / review a card

export interface Schedule {
  /** null: nothing scheduled (never tried, or only carried over from the old roadmap) */
  dueAt: string | null
  last: Attempt | null
}

function growingStep(streak: number) {
  return GROWING_STEPS[Math.min(streak, GROWING_STEPS.length) - 1] ?? GROWING_STEPS[0]!
}

/** Attempts oldest first */
export function problemSchedule(attempts: Attempt[]): Schedule {
  const last = attempts.at(-1) ?? null
  if (!last || last.imported) return { dueAt: null, last }
  if (last.outcome !== "alone") return { dueAt: addDays(last.at, REDO_AFTER[last.outcome]), last }
  let streak = 0
  for (let i = attempts.length - 1; i >= 0 && attempts[i]?.outcome === "alone"; i--) streak++
  return { dueAt: addDays(last.at, growingStep(streak)), last }
}

/** A new card is due the day after it was written: recall it tomorrow, not right away */
export function cardDueAt(card: Card): string {
  const last = card.reviews.at(-1)
  if (!last) return addDays(card.createdAt, 1)
  if (last.grade !== "solid") return addDays(last.at, CARD_AFTER[last.grade])
  let streak = 0
  for (let i = card.reviews.length - 1; i >= 0 && card.reviews[i]?.grade === "solid"; i--) streak++
  return addDays(last.at, growingStep(streak))
}

export const isDue = (dueAt: string | null, now: number) =>
  dueAt !== null && daysBetween(dueAt, now) >= 0

export const overdueDays = (dueAt: string | null, now: number) =>
  dueAt === null ? 0 : Math.max(0, daysBetween(dueAt, now))

// ---------------------------------------------------------------------------------------------
// A pattern's level

export interface PatternStatus {
  level: Level
  /** Problems solved on my own at least once */
  aloneSolved: number
  /** Problems solved on my own again, at least REVIEW_GAP_DAYS after the first try */
  reviewedAlone: number
  /** How the latest attempt at each problem went; "todo" = never tried */
  outcomes: Record<Outcome | "todo", number>
  problems: number
  /** Problems and cards due today or earlier */
  due: number
  /** Days the most overdue problem or card is late */
  overdue: number
}

const hasNotes = (pattern: Pattern) => Object.values(pattern.sections).some((s) => s.trim())

export function patternStatus(nb: Notebook, pattern: Pattern, now: number): PatternStatus {
  const problems = problemsOf(nb, pattern.id)
  const cards = cardsOf(nb, pattern.id)
  const outcomes: PatternStatus["outcomes"] = { alone: 0, hint: 0, solution: 0, todo: 0 }
  let aloneSolved = 0
  let reviewedAlone = 0
  let due = 0
  let overdue = 0

  for (const problem of problems) {
    const attempts = attemptsOf(nb, problem.id)
    const { dueAt, last } = problemSchedule(attempts)
    outcomes[last?.outcome ?? "todo"]++
    const first = attempts[0]
    if (attempts.some((a) => a.outcome === "alone")) aloneSolved++
    if (
      first &&
      attempts.some((a) => a.outcome === "alone" && daysBetween(first.at, a.at) >= REVIEW_GAP_DAYS)
    ) {
      reviewedAlone++
    }
    if (isDue(dueAt, now)) due++
    overdue = Math.max(overdue, overdueDays(dueAt, now))
  }
  for (const card of cards) {
    const dueAt = cardDueAt(card)
    if (isDue(dueAt, now)) due++
    overdue = Math.max(overdue, overdueDays(dueAt, now))
  }

  const started =
    hasNotes(pattern) ||
    problems.length > 0 ||
    cards.length > 0 ||
    resourcesOf(nb, pattern.id).length > 0 ||
    Boolean(pattern.done)

  let level: Level
  if (pattern.theory) {
    const allSolid =
      cards.length > 0 && cards.every((c) => c.reviews.some((r) => r.grade === "solid"))
    level = pattern.done ? (allSolid ? 3 : 2) : started ? 1 : 0
  } else {
    level =
      reviewedAlone >= GOT_IT_PROBLEMS ? 3 : aloneSolved >= GOT_IT_PROBLEMS ? 2 : started ? 1 : 0
  }
  // Mastered means nothing is late; late for long drops a level
  if (overdue > DROP_AFTER_DAYS && level >= 2) level = (level - 1) as Level
  else if (overdue > 0 && level === 3) level = 2

  return {
    level,
    aloneSolved,
    reviewedAlone,
    outcomes,
    problems: problems.length,
    due,
    overdue,
  }
}

export interface LevelCounts {
  total: number
  byLevel: [number, number, number, number]
  /** Share of patterns at "got it" or better, 0..100 */
  pct: number
}

export function levelCounts(statuses: PatternStatus[]): LevelCounts {
  const byLevel: LevelCounts["byLevel"] = [0, 0, 0, 0]
  for (const s of statuses) byLevel[s.level]++
  const total = statuses.length
  const pct = total ? Math.round(((byLevel[2] + byLevel[3]) / total) * 100) : 0
  return { total, byLevel, pct }
}

export function topicStatus(nb: Notebook, topicId: string, now: number) {
  const patterns = patternsOfTopic(nb, topicId)
  const statuses = patterns.map((p) => patternStatus(nb, p, now))
  const counts = levelCounts(statuses)
  const next = patterns.find((_, i) => statuses[i]!.level < 2)
  const problemIds = new Set(patterns.flatMap((p) => problemsOf(nb, p.id).map((x) => x.id)))
  const solvedAlone = [...problemIds].filter((id) =>
    attemptsOf(nb, id).some((a) => a.outcome === "alone")
  ).length
  return { ...counts, next, problems: problemIds.size, solvedAlone }
}

// ---------------------------------------------------------------------------------------------
// Today

export type Task =
  | { kind: "problem"; problem: Problem; dueAt: string; overdue: number; minutes: number }
  | { kind: "cards"; pattern: Pattern; cards: Card[]; overdue: number; minutes: number }
  | { kind: "continue"; pattern: Pattern; minutes: number }

export interface DueCard {
  card: Card
  dueAt: string
  overdue: number
}

export function dueProblems(nb: Notebook, now: number) {
  return liveValues(nb.problems)
    .map((problem) => {
      const attempts = attemptsOf(nb, problem.id)
      const { dueAt, last } = problemSchedule(attempts)
      return { problem, dueAt, last }
    })
    .filter((x): x is typeof x & { dueAt: string } => isDue(x.dueAt, now))
    .map((x) => ({ ...x, overdue: overdueDays(x.dueAt, now) }))
    .sort((a, b) => b.overdue - a.overdue || a.dueAt.localeCompare(b.dueAt))
}

export function dueCards(nb: Notebook, now: number): DueCard[] {
  return liveValues(nb.cards)
    .filter((card) => getLive(nb.patterns, card.patternId))
    .map((card) => {
      const dueAt = cardDueAt(card)
      return { card, dueAt, overdue: overdueDays(dueAt, now) }
    })
    .filter((x) => isDue(x.dueAt, now))
    .sort((a, b) => b.overdue - a.overdue || a.dueAt.localeCompare(b.dueAt))
}

export function todayTasks(nb: Notebook, now: number): Task[] {
  const tasks: Task[] = dueProblems(nb, now).map(({ problem, dueAt, last, overdue }) => ({
    kind: "problem",
    problem,
    dueAt,
    overdue,
    minutes: last?.minutes ?? DEFAULT_PROBLEM_MINUTES,
  }))

  const cardsByPattern = new Map<string, DueCard[]>()
  for (const due of dueCards(nb, now)) push(cardsByPattern, due.card.patternId, due)
  for (const [patternId, list] of cardsByPattern) {
    const pattern = getLive(nb.patterns, patternId)
    if (!pattern) continue
    tasks.push({
      kind: "cards",
      pattern,
      cards: list.map((d) => d.card),
      overdue: Math.max(...list.map((d) => d.overdue)),
      minutes: list.length * MINUTES_PER_CARD,
    })
  }

  // Keep going on the pattern touched last, while it is still being learned
  const learning = liveValues(nb.patterns)
    .filter((p) => !cardsByPattern.has(p.id) && patternStatus(nb, p, now).level === 1)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  if (learning) tasks.push({ kind: "continue", pattern: learning, minutes: 30 })
  return tasks
}

// ---------------------------------------------------------------------------------------------
// Activity

/** Day (YYYY-MM-DD) -> problems tried and cards reviewed that day */
export function activityByDay(nb: Notebook): Map<string, number> {
  const days = new Map<string, number>()
  const add = (iso: string) => {
    const key = dayKey(iso)
    days.set(key, (days.get(key) ?? 0) + 1)
  }
  for (const a of liveValues(nb.attempts)) if (!a.imported) add(a.at)
  for (const c of liveValues(nb.cards)) for (const r of c.reviews) add(r.at)
  return days
}

/** Days in a row with some activity, up to today (or yesterday, before today's first) */
export function streakDays(activity: Map<string, number>, now: number): number {
  let day = startOfDay(now)
  if (!activity.has(dayKey(day))) day -= 24 * 60 * 60 * 1000
  let streak = 0
  // Step by calendar day: a DST change makes some days 23 or 25 hours long
  for (;;) {
    if (!activity.has(dayKey(day))) return streak
    streak++
    const d = new Date(day)
    d.setDate(d.getDate() - 1)
    day = d.getTime()
  }
}

/** Activity over the last 7 days, today included */
export function weekActivity(activity: Map<string, number>, now: number): number {
  let total = 0
  const d = new Date(startOfDay(now))
  for (let i = 0; i < 7; i++) {
    total += activity.get(dayKey(d.getTime())) ?? 0
    d.setDate(d.getDate() - 1)
  }
  return total
}

// ---------------------------------------------------------------------------------------------
// Search

/** Lower case without Vietnamese accents: "nhan dien" finds "Nhận diện" */
export const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()

export type SearchHit =
  | { kind: "topic"; id: string; title: string }
  | { kind: "pattern"; id: string; title: string; topicId: string }
  | { kind: "problem"; id: string; title: string; url: string }
  | { kind: "resource"; id: string; title: string; url: string; patternId?: string }

export function search(nb: Notebook, query: string, limit = 30): SearchHit[] {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const matches = (...texts: string[]) => {
    const haystack = fold(texts.join(" \n "))
    return words.every((w) => haystack.includes(w))
  }
  const hits: SearchHit[] = []
  for (const t of topicsOf(nb))
    if (matches(t.name)) hits.push({ kind: "topic", id: t.id, title: t.name })
  for (const p of liveValues(nb.patterns)) {
    if (matches(p.name, ...Object.values(p.sections))) {
      hits.push({ kind: "pattern", id: p.id, title: p.name, topicId: p.topicId })
    }
  }
  for (const p of liveValues(nb.problems)) {
    const attemptText = attemptsOf(nb, p.id).map((a) => `${a.note}\n${a.code}`)
    if (matches(p.title, p.url, p.notes, ...attemptText)) {
      hits.push({ kind: "problem", id: p.id, title: p.title, url: p.url })
    }
  }
  for (const r of liveValues(nb.resources)) {
    if (matches(r.title, r.url, r.takeaway)) {
      hits.push({
        kind: "resource",
        id: r.id,
        title: r.title,
        url: r.url,
        patternId: r.patternIds[0],
      })
    }
  }
  return hits.slice(0, limit)
}
