import { z } from "zod"
import {
  KEBAB,
  ModuleSchema,
  PhaseSchema,
  type Item,
  type Localized,
  type Phase,
} from "@/content/schema"

// The suggestions in data/: one folder per module, bundled at build time and checked against
// the schema and the naming rules in data/README.md. Editing a file there shows up at once
// under `npm run dev`; start.sh rebuilds on every start.

export const MODULE_FILE = "module.json"

/** "01-basic-data-structures.json": a two-digit order, then lowercase kebab-case */
const PHASE_FILE = /^(\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.json$/

export interface Module {
  /** The folder name, e.g. "dsa" */
  id: string
  /** The topic whose page offers it */
  topicId: string
  title: Localized<string>
  /** In file-name order */
  phases: Phase[]
}

export interface ItemEntry {
  item: Item
  phase: Phase
  module: Module
}

export interface Content {
  /** In folder-name order */
  modules: Module[]
  /** item id -> the item, its phase and its module */
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

const bundled = import.meta.glob<unknown>("../../data/**/*.json", {
  eager: true,
  import: "default",
})

/** path under data/ -> parsed JSON, e.g. "dsa/module.json" -> {...} */
export const dataFiles = new Map(
  Object.entries(bundled).map(([path, json]) => [path.replace(/^(\.\.\/)+data\//, ""), json])
)

function parse<T extends z.ZodType>(schema: T, file: string, json: unknown): z.infer<T> {
  if (json === undefined) throw new ContentError(file, "file not found")
  const result = schema.safeParse(json)
  if (!result.success) throw new ContentError(file, `\n${z.prettifyError(result.error)}`)
  return result.data
}

/** module folder -> its phase file names, sorted; checks where each file sits and its name */
function moduleFolders(paths: Iterable<string>): Map<string, string[]> {
  const folders = new Map<string, string[]>()
  for (const path of paths) {
    const [dir, name, ...rest] = path.split("/")
    if (!dir || !name || rest.length)
      throw new ContentError(path, "must sit directly in a module folder: data/<module>/<file>")
    if (!KEBAB.test(dir))
      throw new ContentError(path, `module folder "${dir}" must be lowercase kebab-case`)
    const names = folders.get(dir) ?? []
    if (name !== MODULE_FILE) {
      if (!PHASE_FILE.test(name))
        throw new ContentError(path, `phase files are named like "01-basic-data-structures.json"`)
      const order = name.slice(0, 2)
      const clash = names.find((other) => other.slice(0, 2) === order)
      if (clash) throw new ContentError(path, `order ${order} is already used by ${clash}`)
      names.push(name)
    }
    folders.set(dir, names)
  }
  for (const names of folders.values()) names.sort()
  return folders
}

export function buildContent(files: Map<string, unknown>): Content {
  const folders = moduleFolders(files.keys())
  const modules: Module[] = []
  const items = new Map<string, ItemEntry>()
  // Every id in data/ is unique: the notebook keeps them all in one place
  const owner = new Map<string, string>()
  const claim = (id: string, file: string) => {
    const first = owner.get(id)
    if (first) throw new ContentError(file, `id "${id}" is already used in ${first}`)
    owner.set(id, file)
  }

  for (const [dir, names] of [...folders].sort(([a], [b]) => a.localeCompare(b))) {
    const metaFile = `${dir}/${MODULE_FILE}`
    const meta = parse(ModuleSchema, metaFile, files.get(metaFile))
    if (!names.length) throw new ContentError(metaFile, "the module has no phase files")
    const module: Module = { id: dir, topicId: meta.topic, title: meta.title, phases: [] }
    for (const name of names) {
      const file = `${dir}/${name}`
      const phase = parse(PhaseSchema, file, files.get(file))
      claim(phase.id, file)
      for (const item of phase.items) {
        claim(item.id, file)
        items.set(item.id, { item, phase, module })
      }
      module.phases.push(phase)
    }
    modules.push(module)
  }

  return { modules, items }
}

export function loadContent(files: Map<string, unknown> = dataFiles): LoadResult {
  try {
    return { ok: true, content: buildContent(files) }
  } catch (error) {
    if (error instanceof ContentError) return { ok: false, error }
    throw error
  }
}

/** The modules a topic's page offers */
export const modulesOf = (content: Content, topicId: string) =>
  content.modules.filter((m) => m.topicId === topicId)
