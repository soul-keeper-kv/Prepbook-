import { z } from "zod"
import { LANG_CODES } from "@/i18n/languages"
import { DEFAULT_TOPICS, SECTION_TEMPLATES } from "@/notebook/templates"

// Shape of the files in data/ (documented for authors in data/README.md).
// Objects are strict, so a misspelt field ("resource") is reported instead of silently ignored.

/** A plain value shared by every language, or one value per language: { "vi": ..., "en": ... } */
const localized = <T extends z.ZodType>(inner: T) =>
  z.union([
    inner,
    z
      .partialRecord(z.enum(LANG_CODES), inner)
      .refine((value) => Object.keys(value).length > 0, "needs at least one language"),
  ])

const httpUrl = z.url({ protocol: /^https?$/, message: "must be an http(s) URL" })

const Text = localized(z.string())

/** Lowercase kebab-case: "p1-twoptr", "java-collections" */
export const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Patterns and phases made from a suggestion keep its id (pt_<id>, ph_<id>) in the notebook:
 * renaming one breaks the link to what the user already added.
 */
const Id = z.string().regex(KEBAB, "must be lowercase kebab-case, e.g. java-collections")

const Problem = z.strictObject({
  title: Text,
  url: httpUrl,
  level: z.string().optional(),
  guides: z.array(z.strictObject({ title: Text.optional(), url: httpUrl })).optional(),
})

export const RESOURCE_TYPES = [
  "article",
  "video",
  "course",
  "docs",
  "book",
  "visual",
  "practice",
] as const

const Resource = z.strictObject({
  type: z.enum(RESOURCE_TYPES),
  title: Text,
  url: httpUrl,
})

/** Every note section of every topic kind; the loader checks they fit the module's topic */
export const NOTE_KEYS = [...new Set(Object.values(SECTION_TEMPLATES).flat())] as [
  string,
  ...string[],
]

/** Markdown: one string, or one string per line */
const NoteText = localized(z.union([z.string(), z.array(z.string())]))

export const ItemSchema = z.strictObject({
  id: Id,
  title: Text,
  problems: z.array(Problem).optional(),
  resources: z.array(Resource).optional(),
  /** Suggested text for the pattern's note sections, copied in only when the user asks */
  notes: z.partialRecord(z.enum(NOTE_KEYS), NoteText).optional(),
})

export const PhaseSchema = z.strictObject({
  id: Id,
  name: Text,
  items: z.array(ItemSchema),
})

const TOPIC_IDS = DEFAULT_TOPICS.map((t) => t.id)

export const ModuleSchema = z.strictObject({
  /** The topic whose page offers this module: a default topic, since their ids never change */
  topic: z.string().refine((id) => TOPIC_IDS.includes(id), {
    message: `must be one of ${TOPIC_IDS.join(", ")}`,
  }),
  title: Text,
})

export type Localized<T> = T | Partial<Record<(typeof LANG_CODES)[number], T>>
export type Item = z.infer<typeof ItemSchema>
export type Phase = z.infer<typeof PhaseSchema>
export type ModuleMeta = z.infer<typeof ModuleSchema>
export type Problem = z.infer<typeof Problem>
export type Resource = z.infer<typeof Resource>
export type NoteText = z.infer<typeof NoteText>
export type ResourceType = (typeof RESOURCE_TYPES)[number]
