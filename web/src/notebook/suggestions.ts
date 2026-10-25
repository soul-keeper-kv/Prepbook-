import type { Content } from "@/content/load"
import { localize } from "@/content/localize"
import type { Item, Phase as OldPhase, ResourceType } from "@/content/schema"
import type { Lang } from "@/i18n/languages"
import { normalizeUrl, problemIdFor } from "@/notebook/ids"
import { getLive, problemsOf, resourcesOf } from "@/notebook/logic"
import type { Notebook, Pattern, ResourceKind } from "@/notebook/schema"
import { DSA_TOPIC_ID } from "@/notebook/templates"

// The old DSA roadmap (data/*.json) is not the user's content any more: it only suggests.
// Phases and items become phases and patterns when the user adds them, and the problems and
// links of an item are offered on the pattern made from it. Ids are derived from the old ids,
// so adding the same suggestion on two devices makes one pattern, not two.

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

export interface SuggestedPhase {
  phaseId: string
  name: string
  time: string
  items: SuggestedItem[]
}

const plain = (text: string) => text.replace(/`|\*\*/g, "")

export function suggestedProblems(item: Item, lang: Lang): SuggestedProblem[] {
  return (item.problems ?? []).map((p) => ({
    url: p.url,
    title: plain(localize(p.title, lang)),
    level: (p.level ?? "").toLowerCase(),
  }))
}

export function suggestedResources(item: Item, lang: Lang): SuggestedResource[] {
  return (item.resources ?? []).map((r) => ({
    url: r.url,
    title: plain(localize(r.title, lang)),
    kind: RESOURCE_KIND[r.type],
  }))
}

export function roadmapSuggestions(content: Content, nb: Notebook, lang: Lang): SuggestedPhase[] {
  return content.phases.map((phase) => ({
    phaseId: phase.id,
    name: plain(localize(phase.name, lang)),
    time: localize(phase.time, lang) ?? "",
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

/** What the old roadmap offers for a pattern made from one of its items, minus what is in */
export function patternSuggestions(content: Content, nb: Notebook, pattern: Pattern, lang: Lang) {
  const entry = pattern.sourceId ? content.items.get(pattern.sourceId) : undefined
  if (!entry) return { problems: [], resources: [] }
  const linked = new Set(problemsOf(nb, pattern.id).map((p) => p.id))
  const read = new Set(resourcesOf(nb, pattern.id).map((r) => normalizeUrl(r.url)))
  return {
    problems: suggestedProblems(entry.item, lang).filter((p) => !linked.has(problemIdFor(p.url))),
    resources: suggestedResources(entry.item, lang).filter((r) => !read.has(normalizeUrl(r.url))),
  }
}

export interface UrlMatch {
  title: string
  level: string
  /** Pattern of the notebook this problem belongs to, by the old roadmap */
  patternId?: string
}

/** A pasted link the old roadmap or the notebook already knows: title, level, pattern */
export function lookupUrl(
  content: Content,
  nb: Notebook,
  url: string,
  lang: Lang
): UrlMatch | null {
  const known = getLive(nb.problems, problemIdFor(url))
  if (known) return { title: known.title, level: known.level, patternId: known.patternIds[0] }
  const key = normalizeUrl(url)
  for (const phase of content.phases) {
    for (const item of phase.items) {
      const problem = item.problems?.find((p) => normalizeUrl(p.url) === key)
      if (problem) {
        const patternId = patternIdFor(item.id)
        return {
          title: plain(localize(problem.title, lang)),
          level: (problem.level ?? "").toLowerCase(),
          patternId: getLive(nb.patterns, patternId) ? patternId : undefined,
        }
      }
    }
  }
  return null
}

/** The old phase an item is in */
export function oldPhaseOf(content: Content, itemId: string): OldPhase | undefined {
  return content.items.get(itemId)?.phase
}

export { DSA_TOPIC_ID }
