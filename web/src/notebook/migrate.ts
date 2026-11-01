import type { Content } from "@/content/load"
import { localize } from "@/content/localize"
import type { Lang } from "@/i18n/languages"
import { nowIso } from "@/lib/dates"
import { hashId, problemIdFor } from "@/notebook/ids"
import type { Notebook, Pattern, Phase, Problem } from "@/notebook/schema"
import { patternIdFor, phaseIdFor, suggestedProblems } from "@/notebook/suggestions"
import { DEFAULT_TOPICS } from "@/notebook/templates"
import { legacyModule } from "@/progress/legacy"
import type { Progress } from "@/progress/schema"

// Carries the old roadmap progress (ticks, notes, code, solved problems) into the notebook,
// once per device. Ids come from the old ids and dates are fixed, so the PC and the phone
// carrying over the same old progress produce the same entities and merge into one.

/** Date of entities made by the app rather than by the user: any real edit is newer */
export const EPOCH = new Date(0).toISOString()

const plain = (text: string) => text.replace(/`|\*\*/g, "")

/** Adds the default topics the notebook has never had (a deleted one stays deleted) */
export function withDefaultTopics(nb: Notebook, lang: Lang): Notebook {
  const missing = DEFAULT_TOPICS.filter((t) => !nb.topics[t.id])
  if (!missing.length) return nb
  const topics = { ...nb.topics }
  for (const t of missing) {
    topics[t.id] = {
      id: t.id,
      updatedAt: EPOCH,
      name: t.name[lang],
      kind: t.kind,
      color: t.color,
      order: DEFAULT_TOPICS.indexOf(t),
    }
  }
  return { ...nb, topics }
}

/** The phase and pattern a suggested item becomes, in its module's topic; nothing filled in yet */
export function patternFromItem(
  content: Content,
  itemId: string,
  lang: Lang,
  at: string
): { phase: Phase; pattern: Pattern } | null {
  const entry = content.items.get(itemId)
  if (!entry) return null
  const { item, phase: oldPhase, module } = entry
  const phase: Phase = {
    id: phaseIdFor(oldPhase.id),
    updatedAt: at,
    topicId: module.topicId,
    name: plain(localize(oldPhase.name, lang)),
    order: module.phases.indexOf(oldPhase),
    sourceId: oldPhase.id,
  }
  const pattern: Pattern = {
    id: patternIdFor(itemId),
    updatedAt: at,
    topicId: module.topicId,
    phaseId: phase.id,
    name: plain(localize(item.title, lang)),
    order: oldPhase.items.indexOf(item),
    theory: !item.problems?.length,
    sections: {},
    requires: [],
    related: [],
    sourceId: itemId,
    createdAt: at,
  }
  return { phase, pattern }
}

/** Move an untouched DSA suggestion pattern when its source item moves to another phase. */
export function syncSuggestedPatternPhases(nb: Notebook, content: Content, lang: Lang): Notebook {
  let phases = nb.phases
  let patterns = nb.patterns
  const at = nowIso()

  for (const pattern of Object.values(nb.patterns)) {
    if (pattern.deleted || !pattern.sourceId) continue
    const entry = content.items.get(pattern.sourceId)
    if (!entry || entry.module.id !== "dsa" || pattern.topicId !== entry.module.topicId) continue

    const destination = patternFromItem(content, pattern.sourceId, lang, at)
    if (!destination || pattern.phaseId === destination.phase.id) continue
    if (nb.phases[destination.phase.id]?.deleted) continue

    // DSA item IDs keep their original phase prefix when an item is moved. Only follow the
    // move when the saved pattern still sits in that original source phase; a user drag to
    // another phase is respected.
    const originalPhaseId = pattern.sourceId.match(/^(p\d+)-/)?.[1]
    const savedPhase = pattern.phaseId ? nb.phases[pattern.phaseId] : undefined
    if (
      !originalPhaseId ||
      !savedPhase ||
      savedPhase.deleted ||
      savedPhase.sourceId !== originalPhaseId ||
      savedPhase.id !== phaseIdFor(originalPhaseId)
    ) {
      continue
    }

    if (phases === nb.phases) phases = { ...nb.phases }
    phases[destination.phase.id] ??= destination.phase
    if (patterns === nb.patterns) patterns = { ...nb.patterns }
    patterns[pattern.id] = {
      ...pattern,
      phaseId: destination.phase.id,
      order: entry.phase.items.indexOf(entry.item),
      updatedAt: at,
    }
  }

  return phases === nb.phases && patterns === nb.patterns ? nb : { ...nb, phases, patterns }
}

const fence = (code: string, lang: string) => `\`\`\`${lang}\n${code.replace(/\n+$/, "")}\n\`\`\``

/**
 * Old items with any progress become patterns: their notes go to "Idea", their code to
 * "Template", and each problem ticked solved becomes a problem with one "solved on my own"
 * attempt marked imported (the old app did not record how it went).
 */
export function migrateProgress(
  nb: Notebook,
  progress: Progress,
  content: Content,
  lang: Lang,
  codeLang: string
): Notebook {
  const out: Notebook = {
    ...nb,
    phases: { ...nb.phases },
    patterns: { ...nb.patterns },
    problems: { ...nb.problems },
    attempts: { ...nb.attempts },
  }

  // The old app only knew its own roadmap: other modules have nothing to carry over
  const items = legacyModule(content)?.phases.flatMap((phase) => phase.items) ?? []
  for (const item of items) {
    const itemId = item.id
    const old = progress.items[itemId] ?? {}
    const solved = suggestedProblems(item, lang).filter((p) => progress.solved[p.url])
    const notes = old.notes?.trim() ?? ""
    const code = old.code?.trim() ? old.code : ""
    if (!old.done && !notes && !code && !solved.length) continue

    const made = patternFromItem(content, itemId, lang, EPOCH)
    if (!made) continue
    const { phase, pattern } = made
    const sections: Record<string, string> = {}
    if (notes) sections.idea = old.notes ?? ""
    if (code) sections.template = fence(code, codeLang)

    const existing = out.patterns[pattern.id]
    if (existing?.deleted) continue // the user deleted it: leave it deleted
    out.phases[phase.id] ??= phase
    if (existing) {
      // Importing an old file into a notebook that has this pattern: fill only empty sections
      const filled = { ...existing.sections }
      for (const [key, text] of Object.entries(sections))
        if (!filled[key]?.trim()) filled[key] = text
      if (JSON.stringify(filled) !== JSON.stringify(existing.sections)) {
        out.patterns[pattern.id] = {
          ...existing,
          sections: filled,
          updatedAt: new Date().toISOString(),
        }
      }
    } else {
      out.patterns[pattern.id] = {
        ...pattern,
        createdAt: old.doneAt ?? EPOCH,
        done: pattern.theory ? Boolean(old.done) : undefined,
        sections,
      }
    }

    for (const p of solved) {
      const id = problemIdFor(p.url)
      const existing = out.problems[id]
      if (existing?.deleted) continue
      if (existing?.patternIds.includes(pattern.id)) continue
      const problem: Problem = existing
        ? {
            ...existing,
            patternIds: [...existing.patternIds, pattern.id],
            updatedAt: existing.updatedAt === EPOCH ? EPOCH : new Date().toISOString(),
          }
        : {
            id,
            updatedAt: EPOCH,
            url: p.url,
            title: p.title,
            level: p.level,
            patternIds: [pattern.id],
            notes: "",
            createdAt: EPOCH,
          }
      out.problems[id] = problem
      const attemptId = hashId("at", `import|${id}`)
      const solvedAt = progress.solved[p.url]
      out.attempts[attemptId] ??= {
        id: attemptId,
        updatedAt: EPOCH,
        problemId: id,
        at: solvedAt && solvedAt !== EPOCH ? solvedAt : EPOCH,
        minutes: null,
        outcome: "alone",
        mistakes: [],
        note: "",
        code: "",
        lang: "",
        imported: true,
      }
    }
  }
  return out
}

/** True when the old progress has anything worth carrying over */
export const hasOldProgress = (progress: Progress) =>
  Object.keys(progress.solved).length > 0 ||
  Object.values(progress.items).some((p) => p.done || p.notes?.trim() || p.code?.trim())
