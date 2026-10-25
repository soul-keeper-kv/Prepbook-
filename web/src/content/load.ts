import { z } from "zod"
import {
  ManifestSchema,
  PhaseSchema,
  type ChecklistEntry,
  type Item,
  type Localized,
  type Phase,
} from "@/content/schema"

// The roadmap content is bundled at build time from data/*.json and checked against the schema.
// Editing a file there shows up at once under `npm run dev`; start.sh rebuilds on every start.

export const MANIFEST_FILE = "manifest.json"

export interface ItemEntry {
  item: Item
  phase: Phase
}

export interface Content {
  title: Localized<string>
  subtitle?: Localized<string>
  checklist: ChecklistEntry[]
  phases: Phase[]
  /** item id -> item and the phase it belongs to */
  items: Map<string, ItemEntry>
}

export class ContentError extends Error {
  readonly file: string
  constructor(file: string, message: string) {
    super(`${file}: ${message}`)
    this.name = "ContentError"
    this.file = file
  }
}

export type LoadResult = { ok: true; content: Content } | { ok: false; error: ContentError }

const bundled = import.meta.glob<unknown>("../../data/*.json", { eager: true, import: "default" })

/** file name -> parsed JSON, e.g. "manifest.json" -> {...} */
export const dataFiles = new Map(
  Object.entries(bundled).map(([path, json]) => [path.split("/").pop() ?? path, json])
)

function parse<T extends z.ZodType>(schema: T, file: string, json: unknown): z.infer<T> {
  if (json === undefined) throw new ContentError(file, "file not found in data/")
  const result = schema.safeParse(json)
  if (!result.success) throw new ContentError(file, `\n${z.prettifyError(result.error)}`)
  return result.data
}

export function buildContent(files: Map<string, unknown>): Content {
  const manifest = parse(ManifestSchema, MANIFEST_FILE, files.get(MANIFEST_FILE))
  const phases = manifest.phases.map((file) => parse(PhaseSchema, file, files.get(file)))

  const phaseIds = new Set<string>()
  const items = new Map<string, ItemEntry>()
  phases.forEach((phase, i) => {
    const file = manifest.phases[i] ?? ""
    if (phaseIds.has(phase.id)) throw new ContentError(file, `phase id "${phase.id}" is duplicated`)
    phaseIds.add(phase.id)
    for (const item of phase.items) {
      if (items.has(item.id)) throw new ContentError(file, `item id "${item.id}" is duplicated`)
      items.set(item.id, { item, phase })
    }
  })

  return {
    title: manifest.title,
    subtitle: manifest.subtitle,
    checklist: manifest.codeReviewChecklist,
    phases,
    items,
  }
}

export function loadContent(files: Map<string, unknown> = dataFiles): LoadResult {
  try {
    return { ok: true, content: buildContent(files) }
  } catch (error) {
    if (error instanceof ContentError) return { ok: false, error }
    throw error
  }
}
