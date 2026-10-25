import { z } from "zod"

// The notebook: everything the user writes. Saved in localStorage (prep_notebook_v1), in the
// Drive file and in exported files, always in this shape: one map per collection, id -> entity.
//
// Every entity has `updatedAt` (merging two copies picks the newer one per field, see
// merge.ts) and is never removed, only marked `deleted`, so a delete on one device is not
// undone by the other device's older copy.
//
// Parsing is lenient inside: a broken entity is dropped and a broken field falls back to its
// default, rather than rejecting the whole copy (an empty notebook could then be uploaded over
// the Drive file). Objects are loose, so fields written by a newer version survive.

export const TOPIC_KINDS = ["dsa", "concept", "design", "story"] as const
export const TOPIC_COLORS = ["blue", "orange", "teal", "purple", "green", "pink", "gray"] as const
/** How a problem went: on my own, needed a hint, had to read the solution */
export const OUTCOMES = ["alone", "hint", "solution"] as const
export const MISTAKES = ["pattern", "boundary", "edge", "complexity", "bug", "api"] as const
export const GRADES = ["forgot", "fuzzy", "solid"] as const
export const RESOURCE_KINDS = ["article", "video", "course", "docs", "book", "other"] as const
export const COLLECTIONS = [
  "topics",
  "phases",
  "patterns",
  "problems",
  "attempts",
  "resources",
  "cards",
  "inbox",
  "conflicts",
] as const

export type TopicKind = (typeof TOPIC_KINDS)[number]
export type TopicColor = (typeof TOPIC_COLORS)[number]
export type Outcome = (typeof OUTCOMES)[number]
export type Mistake = (typeof MISTAKES)[number]
export type Grade = (typeof GRADES)[number]
export type ResourceKind = (typeof RESOURCE_KINDS)[number]
export type Collection = (typeof COLLECTIONS)[number]

const text = z.string().catch("")
const idList = z.array(z.string()).catch([])
const optionalString = z.string().optional().catch(undefined)

const base = {
  id: z.string().min(1),
  updatedAt: z.string(),
  deleted: z.boolean().optional().catch(undefined),
}

export const TopicSchema = z.looseObject({
  ...base,
  name: z.string(),
  kind: z.enum(TOPIC_KINDS).catch("concept"),
  color: z.enum(TOPIC_COLORS).catch("gray"),
  order: z.number().catch(0),
})

export const PhaseSchema = z.looseObject({
  ...base,
  topicId: z.string(),
  name: z.string(),
  order: z.number().catch(0),
  /** Phase of the old DSA roadmap it was created from */
  sourceId: optionalString,
})

export const PatternSchema = z.looseObject({
  ...base,
  topicId: z.string(),
  /** null: directly under the topic, in no phase */
  phaseId: z.string().nullable().catch(null),
  name: z.string(),
  order: z.number().catch(0),
  /** Pure theory (Big-O, the JVM...): no problems, ticked done by hand */
  theory: z.boolean().catch(false),
  done: z.boolean().optional().catch(undefined),
  /** Section key (see templates.ts) -> the user's Markdown */
  sections: z.record(z.string(), z.string()).catch({}),
  /** Patterns to learn first */
  requires: idList,
  related: idList,
  /** Item of the old DSA roadmap it was created from: its problems become suggestions */
  sourceId: optionalString,
  createdAt: z.string(),
})

export const ProblemSchema = z.looseObject({
  ...base,
  url: z.string(),
  title: z.string(),
  level: text,
  /** A problem can train several patterns */
  patternIds: idList,
  notes: text,
  createdAt: z.string(),
})

export const AttemptSchema = z.looseObject({
  ...base,
  problemId: z.string(),
  at: z.string(),
  minutes: z.number().nullable().catch(null),
  outcome: z.enum(OUTCOMES),
  mistakes: idList,
  note: text,
  code: text,
  lang: text,
  /** Carried over from a "solved" tick of the old roadmap */
  imported: z.boolean().optional().catch(undefined),
})

export const ResourceSchema = z.looseObject({
  ...base,
  url: z.string(),
  title: z.string(),
  kind: z.enum(RESOURCE_KINDS).catch("other"),
  patternIds: idList,
  /** What I took away from it */
  takeaway: text,
  createdAt: z.string(),
})

const ReviewSchema = z.object({ at: z.string(), grade: z.enum(GRADES) })

export const CardSchema = z.looseObject({
  ...base,
  patternId: z.string(),
  question: text,
  answer: text,
  reviews: z
    .array(ReviewSchema.nullable().catch(null))
    .catch([])
    .transform((list) => list.filter((r) => r !== null)),
  createdAt: z.string(),
})

export const InboxItemSchema = z.looseObject({
  ...base,
  url: text,
  title: text,
  note: text,
  createdAt: z.string(),
})

/** A text that lost a merge (edited on two devices): kept so the user can pick it back */
export const ConflictSchema = z.looseObject({
  ...base,
  collection: z.enum(COLLECTIONS),
  entityId: z.string(),
  /** "notes", or "sections.<key>" for a pattern section */
  field: z.string(),
  text: z.string(),
  at: z.string(),
})

export type Topic = z.infer<typeof TopicSchema>
export type Phase = z.infer<typeof PhaseSchema>
export type Pattern = z.infer<typeof PatternSchema>
export type Problem = z.infer<typeof ProblemSchema>
export type Attempt = z.infer<typeof AttemptSchema>
export type Resource = z.infer<typeof ResourceSchema>
export type Card = z.infer<typeof CardSchema>
export type CardReview = z.infer<typeof ReviewSchema>
export type InboxItem = z.infer<typeof InboxItemSchema>
export type Conflict = z.infer<typeof ConflictSchema>

export interface EntityMap {
  topics: Topic
  phases: Phase
  patterns: Pattern
  problems: Problem
  attempts: Attempt
  resources: Resource
  cards: Card
  inbox: InboxItem
  conflicts: Conflict
}

export type Entity = EntityMap[Collection]

export type Notebook = { v: 1 } & { [C in Collection]: Record<string, EntityMap[C]> }

/** id -> entity, dropping entries that do not parse or whose id does not match their key */
const collection = <T extends z.ZodType<{ id: string }>>(schema: T) =>
  z
    .record(z.string(), z.unknown())
    .catch({})
    .transform((entries) => {
      const out: Record<string, z.infer<T>> = {}
      for (const [key, value] of Object.entries(entries)) {
        const result = schema.safeParse(value)
        if (result.success && result.data.id === key) out[key] = result.data
      }
      return out
    })

// Extra top-level fields (savedAt, exportedAt) are dropped on parse
export const NotebookSchema = z.object({
  v: z.literal(1),
  topics: collection(TopicSchema),
  phases: collection(PhaseSchema),
  patterns: collection(PatternSchema),
  problems: collection(ProblemSchema),
  attempts: collection(AttemptSchema),
  resources: collection(ResourceSchema),
  cards: collection(CardSchema),
  inbox: collection(InboxItemSchema),
  conflicts: collection(ConflictSchema),
})

export function parseNotebook(json: unknown): Notebook | null {
  const result = NotebookSchema.safeParse(json)
  return result.success ? (result.data as Notebook) : null
}

export const emptyNotebook = (): Notebook => ({
  v: 1,
  topics: {},
  phases: {},
  patterns: {},
  problems: {},
  attempts: {},
  resources: {},
  cards: {},
  inbox: {},
  conflicts: {},
})
