import type { Content, Module } from "@/content/load"
import { localize } from "@/content/localize"
import { platformKey } from "@/content/problems"
import type { Item, NoteText, ResourceType } from "@/content/schema"
import { LANG_CODES, type Lang } from "@/i18n/languages"
import { normalizeUrl, problemIdFor } from "@/notebook/ids"
import legacySamples from "@/notebook/legacy-samples.json"
import { getLive, problemsOf, resourcesOf, type SampleTexts } from "@/notebook/logic"
import { sampleHash } from "@/notebook/sample-hash"
import type { Notebook, Pattern, ResourceKind, TopicKind } from "@/notebook/schema"
import { SECTION_TEMPLATES } from "@/notebook/templates"

// The modules in data/ are not the user's content: they only suggest. Phases and items become
// phases and patterns when the user adds them, and the problems and links of an item are
// offered on the pattern made from it. Ids are derived from the ids in data/, so adding the
// same suggestion on two devices makes one pattern, not two.

export const phaseIdFor = (oldPhaseId: string) => `ph_${oldPhaseId}`
export const patternIdFor = (oldItemId: string) => `pt_${oldItemId}`

const RESOURCE_KIND: Record<ResourceType, ResourceKind> = {
  article: "article",
  video: "video",
  course: "course",
  docs: "docs",
  book: "book",
  visual: "other",
  practice: "other",
}

export interface SuggestedProblem {
  url: string
  title: string
  level: string
  /** "LeetCode", "HackerRank"... or "none" */
  platform: string
}

export interface SuggestedResource {
  url: string
  title: string
  kind: ResourceKind
}

export interface SuggestedItem {
  itemId: string
  title: string
  theory: boolean
  problems: SuggestedProblem[]
  resources: SuggestedResource[]
  /** Already a pattern in the notebook */
  added: boolean
}

export interface SuggestedNote {
  /** The note section it goes into: "recognition", "template"... */
  key: string
  text: string
  /** The section already holds this exact text */
  copied: boolean
}

export interface SuggestedPhase {
  phaseId: string
  name: string
  items: SuggestedItem[]
}

const plain = (text: string) => text.replace(/`|\*\*/g, "")

export function suggestedProblems(item: Item, lang: Lang): SuggestedProblem[] {
  return (item.problems ?? []).map((p) => ({
    url: p.url,
    title: plain(localize(p.title, lang)),
    level: (p.level ?? "").toLowerCase(),
    platform: platformKey(p.url),
  }))
}

export function suggestedResources(item: Item, lang: Lang): SuggestedResource[] {
  return (item.resources ?? []).map((r) => ({
    url: r.url,
    title: plain(localize(r.title, lang)),
    kind: RESOURCE_KIND[r.type],
  }))
}

const noteText = (value: NoteText, lang: Lang) => {
  const text = localize(value, lang)
  return (Array.isArray(text) ? text.join("\n") : text).trim()
}

/** A suggested note in every language: a note copied in while in Vietnamese is still a copy in English */
function suggestedNoteTexts(item: Item, key: string): string[] {
  const value = (item.notes as Partial<Record<string, NoteText>> | undefined)?.[key]
  return value ? [...new Set(LANG_CODES.map((lang) => noteText(value, lang)))] : []
}

/** item id -> note key -> sampleHash of each older wording (`npm run samples:legacy`) */
const LEGACY_SAMPLES: Partial<Record<string, Partial<Record<string, string[]>>>> = legacySamples

/** The old sample notes found in a section, as they appear there */
export function oldSamplesIn(section: string, hashes: readonly string[]): string[] {
  // A copied note starts the section or follows a blank line (see withNote)
  const starts = [0]
  for (let i = section.indexOf("\n\n"); i >= 0; i = section.indexOf("\n\n", i + 1))
    starts.push(i + 2)
  const found: string[] = []
  for (const hash of hashes) {
    const length = Number(hash.slice(0, hash.indexOf(":")))
    const text = starts
      .map((start) => section.slice(start, start + length))
      .find((text) => text.length === length && sampleHash(text) === hash)
    if (text) found.push(text)
  }
  return found
}

const samplesCache = new WeakMap<Content, SampleTexts>()

/**
 * The sample notes a pattern's sections may hold, from the item it was made from: the
 * current ones, and older wordings still found in the section (copied before data/ changed)
 */
export function samplesFrom(content: Content): SampleTexts {
  const cached = samplesCache.get(content)
  if (cached) return cached
  const byKey = new Map<string, string[]>()
  const samples: SampleTexts = (pattern, key) => {
    const entry = pattern.sourceId ? content.items.get(pattern.sourceId) : undefined
    if (!entry) return []
    const id = `${entry.item.id}\n${key}`
    let texts = byKey.get(id)
    if (!texts) byKey.set(id, (texts = suggestedNoteTexts(entry.item, key)))
    const old = LEGACY_SAMPLES[entry.item.id]?.[key]
    const section = pattern.sections[key]
    return old && section ? [...texts, ...oldSamplesIn(section, old)] : texts
  }
  samplesCache.set(content, samples)
  return samples
}

/** The section text after copying a suggested note in: below what the user already wrote */
export const withNote = (section: string | undefined, text: string) =>
  section?.trim() ? `${section.trimEnd()}\n\n${text}` : text

export function moduleSuggestions(module: Module, nb: Notebook, lang: Lang): SuggestedPhase[] {
  return module.phases.map((phase) => ({
    phaseId: phase.id,
    name: plain(localize(phase.name, lang)),
    items: phase.items.map((item) => ({
      itemId: item.id,
      title: plain(localize(item.title, lang)),
      theory: !item.problems?.length,
      problems: suggestedProblems(item, lang),
      resources: suggestedResources(item, lang),
      added: Boolean(getLive(nb.patterns, patternIdFor(item.id))),
    })),
  }))
}

/** What an item puts into its pattern: notes copied into sections, problems, links */
export interface SuggestionInput {
  notes: { key: string; text: string }[]
  problems: { url: string; title: string; level: string }[]
  resources: SuggestedResource[]
}

/** An item's notes for the sections of a topic kind, in section order */
function itemNotes(item: Item, kind: TopicKind, lang: Lang) {
  return SECTION_TEMPLATES[kind].flatMap((key) => {
    const value = (item.notes as Partial<Record<string, NoteText>> | undefined)?.[key]
    return value ? [{ key, text: noteText(value, lang) }] : []
  })
}

/** Everything an item offers: what adding it as a pattern puts in */
export const itemSuggestion = (item: Item, kind: TopicKind, lang: Lang): SuggestionInput => ({
  notes: itemNotes(item, kind, lang),
  problems: suggestedProblems(item, lang),
  resources: suggestedResources(item, lang),
})

/**
 * What a module offers for a pattern made from one of its items: problems and links not in
 * yet, and notes for the sections of the pattern's topic (kept even once copied, to reread)
 */
export function patternSuggestions(content: Content, nb: Notebook, pattern: Pattern, lang: Lang) {
  const entry = pattern.sourceId ? content.items.get(pattern.sourceId) : undefined
  if (!entry) return { module: null, notes: [], problems: [], resources: [] }
  const topic = getLive(nb.topics, pattern.topicId)
  const notes: SuggestedNote[] = (topic ? itemNotes(entry.item, topic.kind, lang) : []).map(
    (note) => ({ ...note, copied: (pattern.sections[note.key] ?? "").includes(note.text) })
  )
  const linked = new Set(problemsOf(nb, pattern.id).map((p) => p.id))
  const read = new Set(resourcesOf(nb, pattern.id).map((r) => normalizeUrl(r.url)))
  return {
    module: entry.module,
    notes,
    problems: suggestedProblems(entry.item, lang).filter((p) => !linked.has(problemIdFor(p.url))),
    resources: suggestedResources(entry.item, lang).filter((r) => !read.has(normalizeUrl(r.url))),
  }
}

export interface ProblemFilters {
  platform: string[]
  level: string[]
}

const levelOf = (p: SuggestedProblem) => p.level || "none"
const LEVEL_RANK: Record<string, number> = { easy: 0, medium: 1, hard: 2, advanced: 3, expert: 4 }
/** Easy first; no level or an unknown one last */
export const levelRank = (level: string) => LEVEL_RANK[level.toLowerCase()] ?? 5
const collator = new Intl.Collator(undefined, { sensitivity: "base" })

/**
 * The suggested problems a pattern page shows: those matching both filters (an empty filter
 * keeps all), in the order asked; ties keep the suggested order. The counts say how many
 * each platform or level would show, given the other filter, like the problem table's.
 */
export function pickSuggestedProblems(
  problems: SuggestedProblem[],
  filters: ProblemFilters,
  sort: "order" | "level" | "platform"
) {
  const fits = (p: SuggestedProblem, skip?: keyof ProblemFilters) =>
    (skip === "platform" || !filters.platform.length || filters.platform.includes(p.platform)) &&
    (skip === "level" || !filters.level.length || filters.level.includes(levelOf(p)))
  const counts = (kind: keyof ProblemFilters, keyOf: (p: SuggestedProblem) => string) => {
    const map = new Map<string, number>(problems.map((p) => [keyOf(p), 0]))
    for (const p of problems) if (fits(p, kind)) map.set(keyOf(p), (map.get(keyOf(p)) ?? 0) + 1)
    return map
  }
  const last = (key: string) => (key === "none" ? 1 : 0)
  const shown = problems.filter((p) => fits(p))
  if (sort === "level")
    shown.sort(
      (a, b) => last(levelOf(a)) - last(levelOf(b)) || levelRank(a.level) - levelRank(b.level)
    )
  if (sort === "platform")
    shown.sort(
      (a, b) => last(a.platform) - last(b.platform) || collator.compare(a.platform, b.platform)
    )
  return {
    shown,
    platforms: counts("platform", (p) => p.platform),
    levels: counts("level", levelOf),
  }
}

export interface UrlMatch {
  title: string
  level: string
  /** Pattern of the notebook this problem belongs to, by the modules in data/ */
  patternId?: string
}

/** A pasted link the notebook or data/ already knows: title, level, pattern */
export function lookupUrl(
  content: Content,
  nb: Notebook,
  url: string,
  lang: Lang
): UrlMatch | null {
  const known = getLive(nb.problems, problemIdFor(url))
  if (known) return { title: known.title, level: known.level, patternId: known.patternIds[0] }
  const found = findSuggestedProblem(content, url)
  if (!found) return null
  const patternId = patternIdFor(found.item.id)
  return {
    title: plain(localize(found.problem.title, lang)),
    level: (found.problem.level ?? "").toLowerCase(),
    patternId: getLive(nb.patterns, patternId) ? patternId : undefined,
  }
}

/** The first suggested problem with this link, in any module, and the item listing it */
export function findSuggestedProblem(content: Content, url: string) {
  const key = normalizeUrl(url)
  for (const { item } of content.items.values()) {
    const problem = item.problems?.find((p) => normalizeUrl(p.url) === key)
    if (problem) return { item, problem }
  }
  return undefined
}
