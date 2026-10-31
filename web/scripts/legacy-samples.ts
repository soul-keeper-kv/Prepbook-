import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { sampleHash } from "../src/notebook/sample-hash.ts"

// Run after rewording the `notes` of data/: a pattern made before still holds the old
// wording, and without this it would count as the user's own words (progress comes from
// them). Compares data/ with a git ref and adds a hash of every old wording to
// src/notebook/legacy-samples.json; entries are only ever added.
// Usage: node scripts/legacy-samples.ts [ref] [module...]
//   ref: default HEAD (the last commit); modules: folders of data/ to compare, default all

const ROOT = path.resolve(import.meta.dirname, "..")
const OUT = path.join(ROOT, "src", "notebook", "legacy-samples.json")
const [ref = "HEAD", ...only] = process.argv.slice(2)

type Text = string | string[]
type NoteValue = Text | Partial<Record<string, Text>>
interface PhaseFile {
  items?: { id: string; notes?: Record<string, NoteValue> }[]
}

/** The note as it is copied into a section, in each language (suggestions.ts: noteText) */
const copies = (value: NoteValue) =>
  new Set(
    ["vi", "en"].map((lang) => {
      const text =
        typeof value === "object" && !Array.isArray(value) ? (value[lang] ?? value.vi ?? "") : value
      return (Array.isArray(text) ? text.join("\n") : text).trim()
    })
  )

const readAt = (file: string): PhaseFile | null => {
  try {
    const text = execFileSync("git", ["show", `${ref}:./${file}`], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    })
    return JSON.parse(text) as PhaseFile
  } catch {
    return null // a file the ref does not have
  }
}

const legacy = JSON.parse(fs.readFileSync(OUT, "utf8")) as Record<string, Record<string, string[]>>
let added = 0
for (const module of fs.readdirSync(path.join(ROOT, "data"), { withFileTypes: true })) {
  if (!module.isDirectory() || (only.length && !only.includes(module.name))) continue
  for (const name of fs.readdirSync(path.join(ROOT, "data", module.name))) {
    if (!/^\d{2}-.+\.json$/.test(name)) continue
    const file = `data/${module.name}/${name}`
    const before = readAt(file)
    if (!before) continue
    const now = JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8")) as PhaseFile
    const items = new Map(now.items?.map((item) => [item.id, item]))
    for (const item of before.items ?? []) {
      for (const [key, value] of Object.entries(item.notes ?? {})) {
        const current = items.get(item.id)?.notes?.[key]
        const still = current === undefined ? new Set<string>() : copies(current)
        for (const text of copies(value)) {
          if (!text || still.has(text)) continue
          const hashes = ((legacy[item.id] ??= {})[key] ??= [])
          const hash = sampleHash(text)
          if (!hashes.includes(hash)) {
            hashes.push(hash)
            added++
          }
        }
      }
    }
  }
}

// Sorted, one line per note key (the shape prettier keeps)
const lines = Object.keys(legacy)
  .sort()
  .map((id) => {
    const keys = Object.keys(legacy[id]).sort()
    const body = keys.map(
      (key) =>
        `    ${JSON.stringify(key)}: ${JSON.stringify(legacy[id][key]).replaceAll(",", ", ")}`
    )
    return `  ${JSON.stringify(id)}: {\n${body.join(",\n")}\n  }`
  })
fs.writeFileSync(OUT, lines.length ? `{\n${lines.join(",\n")}\n}\n` : "{}\n")
console.log(`${added} old wordings added to ${path.relative(ROOT, OUT)}`)
