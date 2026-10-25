import { z } from "zod"
import { LANG_CODES } from "@/i18n/languages"

// Shape of the files in data/ (documented for authors in data/README.md).
// Objects are strict, so a misspelt field ("keypoint") is reported instead of silently ignored.

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
const TextList = localized(z.array(localized(z.string())))

const Example = z.strictObject({
  title: Text.optional(),
  input: Text.optional(),
  output: Text.optional(),
  explain: Text.optional(),
})

const Template = z.strictObject({
  lang: z.string().min(1),
  /** One string, or one string per line */
  code: localized(z.union([z.string(), z.array(z.string())])),
})

const Problem = z.strictObject({
  title: Text,
  url: httpUrl,
  level: z.string().optional(),
  note: Text.optional(),
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

export const ITEM_TYPES = ["theory", "practice"] as const

export const ItemSchema = z.strictObject({
  /** Progress is stored under this id: renaming it loses the item's ticks and notes */
  id: z.string().min(1),
  type: z.enum(ITEM_TYPES),
  title: Text,
  description: Text.optional(),
  keyPoints: TextList.optional(),
  examples: localized(z.array(Example)).optional(),
  template: z
    .union([Template, z.array(Template)])
    .transform((t) => (Array.isArray(t) ? t : [t]))
    .refine((list) => new Set(list.map((t) => t.lang)).size === list.length, {
      message: "two templates use the same lang",
    })
    .optional(),
  complexity: Text.optional(),
  pitfalls: TextList.optional(),
  problems: z.array(Problem).optional(),
  resources: z.array(Resource).optional(),
})

export const PhaseSchema = z.strictObject({
  id: z.string().min(1),
  name: Text,
  time: Text.optional(),
  items: z.array(ItemSchema),
})

export const ManifestSchema = z.strictObject({
  title: Text,
  subtitle: Text.optional(),
  /** Phase files, in display order */
  phases: z.array(z.string().min(1)).min(1),
  codeReviewChecklist: z.array(z.strictObject({ id: z.string().min(1), text: Text })).default([]),
})

export type Localized<T> = T | Partial<Record<(typeof LANG_CODES)[number], T>>
export type Item = z.infer<typeof ItemSchema>
export type Phase = z.infer<typeof PhaseSchema>
export type Manifest = z.infer<typeof ManifestSchema>
export type Problem = z.infer<typeof Problem>
export type Resource = z.infer<typeof Resource>
export type ResourceType = (typeof RESOURCE_TYPES)[number]
export type Template = z.infer<typeof Template>
export type Example = z.infer<typeof Example>
export type ItemType = (typeof ITEM_TYPES)[number]
export type ChecklistEntry = Manifest["codeReviewChecklist"][number]
