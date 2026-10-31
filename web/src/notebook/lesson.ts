import type { Content } from "@/content/load"
import { localize } from "@/content/localize"
import type { Localized } from "@/content/schema"
import type { Lang } from "@/i18n/languages"
import { problemIdFor } from "@/notebook/ids"
import { attemptsOf, getLive, ownText, problemsOf } from "@/notebook/logic"
import type { Notebook, Outcome, Pattern } from "@/notebook/schema"
import {
  levelRank,
  patternSuggestions,
  samplesFrom,
  suggestedProblems,
  type SuggestedNote,
} from "@/notebook/suggestions"

// The beginner's path through a DSA pattern: first the theory, in your own words, then three
// problems, one of them guided. Like the level, every tick is worked out from the notebook.

/** Sections to hold in your own words before solving */
export const CHECKPOINTS = ["recognition", "idea", "template"] as const
export type Checkpoint = (typeof CHECKPOINTS)[number]

/** The example to learn from (with a guide, optional), then two to solve alone */
export const PRACTICE_ROLES = ["guided", "solo", "solo"] as const
export type PracticeRole = (typeof PRACTICE_ROLES)[number]

export interface CheckpointState {
  key: Checkpoint
  /** The section holds words of the user's own, not only the sample theory */
  done: boolean
  /** Theory to read first, from data/ */
  note: SuggestedNote | undefined
  /** A clear explanation of this step from data/ (Markdown) */
  guide: string | undefined
}

/** A multiple-choice question to practise recognising the pattern */
export interface QuizQuestion {
  question: string
  options: string[]
  /** Index of the right option */
  answer: number
  why: string
}

export interface PracticeProblem {
  role: PracticeRole
  /** Its id in the notebook, whether or not it has been added yet */
  id: string
  url: string
  title: string
  level: string
  /** In the notebook, under this pattern */
  linked: boolean
  /** How the latest attempt went */
  last: Outcome | undefined
  /** Guided: tried once, any way. Solo: solved alone once */
  done: boolean
}

export interface Lesson {
  /** The beginner's explanation from data/ (Markdown), read before the checkpoints */
  explain: string | undefined
  checkpoints: CheckpointState[]
  /** The sample pitfalls, offered to read when the pitfalls section does not hold them */
  pitfalls: SuggestedNote | undefined
  /** The explanation of the pitfalls step, from data/ */
  pitfallsGuide: string | undefined
  /** Recognition practice, from data/ */
  quiz: QuizQuestion[]
  practice: PracticeProblem[]
}

/** The beginner's lesson data/ has for the pattern's item, as Markdown */
export function explainText(content: Content, pattern: Pattern, lang: Lang): string | undefined {
  const value = pattern.sourceId ? content.items.get(pattern.sourceId)?.item.lesson : undefined
  return markdownOf(value, lang)
}

const markdownOf = (value: Localized<string | string[]> | undefined, lang: Lang) => {
  const text = value && localize(value, lang)
  return Array.isArray(text) ? text.join("\n") : text
}

export function patternLesson(
  content: Content,
  nb: Notebook,
  pattern: Pattern,
  lang: Lang
): Lesson {
  const entry = pattern.sourceId ? content.items.get(pattern.sourceId) : undefined
  const { notes } = patternSuggestions(content, nb, pattern, lang)

  const checkpoints = CHECKPOINTS.map((key): CheckpointState => ({
    key,
    done: ownText(pattern, key, samplesFrom(content)).length > 0,
    note: notes.find((n) => n.key === key),
    guide: markdownOf(entry?.item.guide?.[key], lang),
  }))

  // The easiest suggested problems, in the order data/ gives within a level. The pattern's own
  // problems only fill in when data/ has too few, so adding a problem never swaps the picks.
  const suggested = entry
    ? suggestedProblems(entry.item, lang)
        .map((p, i) => ({ p, i }))
        .sort((a, b) => levelRank(a.p.level) - levelRank(b.p.level) || a.i - b.i)
        .map(({ p }) => p)
    : []
  const picks: { url: string; title: string; level: string }[] = []
  const seen = new Set<string>()
  for (const p of [...suggested, ...problemsOf(nb, pattern.id)]) {
    const id = problemIdFor(p.url)
    if (seen.has(id) || picks.length === PRACTICE_ROLES.length) continue
    seen.add(id)
    picks.push(p)
  }

  const practice = picks.map((p, i): PracticeProblem => {
    const id = problemIdFor(p.url)
    const role = PRACTICE_ROLES[i]!
    const attempts = attemptsOf(nb, id)
    return {
      role,
      id,
      url: p.url,
      title: p.title,
      level: p.level.toLowerCase(),
      linked: Boolean(getLive(nb.problems, id)?.patternIds.includes(pattern.id)),
      last: attempts.at(-1)?.outcome,
      done: role === "guided" ? attempts.length > 0 : attempts.some((a) => a.outcome === "alone"),
    }
  })

  return {
    explain: explainText(content, pattern, lang),
    checkpoints,
    pitfalls: notes.find((n) => n.key === "pitfalls"),
    pitfallsGuide: markdownOf(entry?.item.guide?.pitfalls, lang),
    quiz: (entry?.item.quiz ?? []).map((q) => ({
      question: localize(q.question, lang),
      options: q.options.map((o) => localize(o, lang)),
      answer: q.answer,
      why: localize(q.why, lang),
    })),
    practice,
  }
}

/** A step of the path: understanding, a checkpoint, or a practice problem by its index */
export type LessonStep = "explain" | Checkpoint | number

/**
 * The step to do next: understanding comes first, until any checkpoint holds words of the
 * user's own; then the first step not done, skipping the optional example once solving began
 */
export function nextLessonStep(lesson: Lesson): LessonStep | undefined {
  if (!lesson.checkpoints.some((c) => c.done)) return "explain"
  const checkpoint = lesson.checkpoints.find((c) => !c.done)
  if (checkpoint) return checkpoint.key
  const started = lesson.practice.some((p) => p.role === "solo" && p.last)
  const index = lesson.practice.findIndex((p) => !p.done && !(p.role === "guided" && started))
  return index >= 0 ? index : undefined
}
