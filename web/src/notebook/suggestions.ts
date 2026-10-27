import type { Content, Module } from "@/content/load"
import { localize } from "@/content/localize"
import { platformKey } from "@/content/problems"
import type { Item, NoteText, ResourceType } from "@/content/schema"
import type { Lang } from "@/i18n/languages"
import { normalizeUrl, problemIdFor } from "@/notebook/ids"
import { getLive, problemsOf, resourcesOf } from "@/notebook/logic"
import type { Notebook, Pattern, ResourceKind } from "@/notebook/schema"
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

/**
 * What a module offers for a pattern made from one of its items: problems and links not in
 * yet, and notes for the sections of the pattern's topic (kept even once copied, to reread)
 */
export function patternSuggestions(content: Content, nb: Notebook, pattern: Pattern, lang: Lang) {
  const entry = pattern.sourceId ? content.items.get(pattern.sourceId) : undefined
  if (!entry) return { module: null, notes: [], problems: [], resources: [] }
  const topic = getLive(nb.topics, pattern.topicId)
  const notes: SuggestedNote[] = (topic ? SECTION_TEMPLATES[topic.kind] : []).flatMap((key) => {
    const value = (entry.item.notes as Partial<Record<string, NoteText>> | undefined)?.[key]
    if (!value) return []
    const text = noteText(value, lang)
    return [{ key, text, copied: (pattern.sections[key] ?? "").includes(text) }]
  })
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
      (a, b) =>
        last(levelOf(a)) - last(levelOf(b)) ||
        (LEVEL_RANK[a.level] ?? 5) - (LEVEL_RANK[b.level] ?? 5)
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
