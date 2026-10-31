import { useId, useState, type ReactNode } from "react"
import {
  BookOpenIcon,
  CheckIcon,
  ChevronRightIcon,
  CodeIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import type { TFunction } from "i18next"
import { LevelBadgeForProblemLevel, ProblemStatusTag } from "@/components/common/badges"
import { AskAiButtons } from "@/components/common/ask-ai"
import { NoteEditor } from "@/components/common/editing"
import { Markdown } from "@/components/common/markdown"
import { NoteDialog } from "@/components/pattern/note-dialog"
import { Quiz } from "@/components/pattern/quiz"
import { LABEL } from "@/components/section"
import { Tag } from "@/components/tag"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { codeLangLabel } from "@/content/code-langs"
import { useContent } from "@/content/context"
import { THINK_MINUTES } from "@/content/problems"
import { cn } from "@/lib/utils"
import { useLang, useNotebook, useSamples } from "@/notebook/hooks"
import {
  CHECKPOINTS,
  PRACTICE_ROLES,
  explainText,
  nextLessonStep,
  patternLesson,
  type PracticeProblem,
  type QuizQuestion,
} from "@/notebook/lesson"
import { GOT_IT_PROBLEMS, REDO_AFTER, ownText } from "@/notebook/logic"
import type { Pattern } from "@/notebook/schema"
import { notebookActions } from "@/notebook/store"
import type { SuggestedNote } from "@/notebook/suggestions"
import { CODE_SECTIONS } from "@/notebook/templates"
import { href, navigate } from "@/state/router"
import { useUiStore } from "@/state/ui"

/** A section of the pattern page, by its element id and numbered title */
export interface SectionTarget {
  id: string
  title: string
}

/** "Example · optional", "Solve alone 1": also shown on the problem's page */
export const practiceLabel = (t: TFunction, practice: PracticeProblem[], index: number) =>
  practice[index]?.role === "guided"
    ? t("lesson.role.guided")
    : t("lesson.role.solo", {
        n: practice.slice(0, index + 1).filter((p) => p.role === "solo").length,
      })

/** Ticked, next or waiting: the circle in front of a step */
function StepMark({ done, next, children }: { done: boolean; next: boolean; children: ReactNode }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-11",
        done
          ? "bg-ok-bg text-ok"
          : next
            ? "bg-primary text-primary-foreground"
            : "border border-border-strong text-muted-foreground"
      )}
    >
      {done ? <CheckIcon className="size-3.5" /> : children}
    </span>
  )
}

interface StepProps {
  mark: ReactNode
  done: boolean
  isNext: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** One row of the path that opens to show its content */
function Step({
  title,
  mark,
  done,
  isNext,
  open,
  onOpenChange,
  children,
}: StepProps & { title: string; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <li className="border-t first:border-t-0">
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger className="group/s flex w-full cursor-pointer items-center gap-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:min-h-11">
          <StepMark done={done} next={isNext}>
            {mark}
          </StepMark>
          <span
            className={cn("min-w-0 flex-1 text-14 font-medium", done && "text-muted-foreground")}
          >
            {title}
            {done && <span className="sr-only"> · {t("lesson.done")}</span>}
          </span>
          {isNext && <Tag tone="link">{t("lesson.next")}</Tag>}
          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/s:rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pb-3 pl-8 max-sm:pl-0">{children}</CollapsibleContent>
      </Collapsible>
    </li>
  )
}

/** Understanding the pattern: the written lesson, or an AI asked to teach it */
function ExplainStep({
  pattern,
  explain,
  ...step
}: StepProps & { pattern: Pattern; explain: string | undefined }) {
  const { t } = useTranslation()
  const codeLang = useUiStore((s) => s.codeLang)
  const prompt = t("prompt.pattern", { pattern: pattern.name, lang: codeLangLabel(codeLang) })
  return (
    <Step title={t("lesson.explainTitle")} {...step}>
      {explain ? (
        <>
          <p className="mb-2 text-13 text-muted-foreground">{t("lesson.explainHint")}</p>
          <div className="text-14">
            <Markdown text={explain} />
          </div>
          <p className="mt-4 mb-1.5 border-t pt-3 text-13 text-muted-foreground">
            {t("lesson.askAgain")}
          </p>
        </>
      ) : (
        <p className="mb-1.5 text-13 text-muted-foreground">{t("lesson.noExplain")}</p>
      )}
      <AskAiButtons prompt={prompt} />
    </Step>
  )
}

/**
 * The lesson on its own, above the sections of a pattern shown without a path (pure theory,
 * like Big-O). Only when data/ has a lesson for it; open to start with.
 */
export function ExplainCard({ pattern }: { pattern: Pattern }) {
  const content = useContent()
  const lang = useLang()
  const [open, setOpen] = useState(true)
  const explain = explainText(content, pattern, lang)
  if (!explain) return null
  return (
    <ol className="rounded-md border bg-card px-4">
      <ExplainStep
        pattern={pattern}
        explain={explain}
        mark={<BookOpenIcon className="size-3" />}
        done={false}
        isNext={false}
        open={open}
        onOpenChange={setOpen}
      />
    </ol>
  )
}

/** A note section of the pattern as a step: opens to read and edit it in place */
function NoteStep({
  pattern,
  sectionKey,
  instruction,
  note,
  guide,
  quiz = [],
  onRead,
  ...step
}: StepProps & {
  pattern: Pattern
  sectionKey: string
  instruction: string
  /** The sample theory, offered to read when the section does not hold it */
  note: SuggestedNote | undefined
  /** The step's explanation from data/, read before writing */
  guide: string | undefined
  /** Practice questions shown after the explanation */
  quiz?: QuizQuestion[]
  onRead: () => void
}) {
  const { t } = useTranslation()
  const samples = useSamples()
  const title = t(`section.${sectionKey}.title` as "section.idea.title")
  const text = pattern.sections[sectionKey] ?? ""
  const sampleOnly = Boolean(text.trim()) && !ownText(pattern, sectionKey, samples)
  // With an explanation to read, notes that are only the copied sample start folded away
  const [notesOpen, setNotesOpen] = useState(!(guide && sampleOnly))
  return (
    <Step title={title} {...step}>
      {guide && (
        <div className="mb-3">
          <Markdown text={guide} />
        </div>
      )}
      {quiz.length > 0 && (
        <div className="mb-3">
          <Quiz questions={quiz} />
        </div>
      )}
      <Collapsible
        open={notesOpen}
        onOpenChange={setNotesOpen}
        className={cn((guide || quiz.length > 0) && "border-t pt-2")}
      >
        <CollapsibleTrigger className="group/n flex w-full cursor-pointer items-center gap-2 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:min-h-11">
          <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/n:rotate-90" />
          <span className={LABEL}>{t("lesson.yourNotes")}</span>
          {sampleOnly && (
            <span className="text-12 text-muted-foreground">{t("lesson.sampleOnly")}</span>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-1">
          <p className="mb-2 text-13 text-muted-foreground">{instruction}</p>
          {note && !note.copied && (
            <button
              type="button"
              className="mb-2 inline-flex cursor-pointer items-center gap-1 rounded-sm text-13 text-link outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring max-md:min-h-11"
              onClick={onRead}
            >
              <BookOpenIcon className="size-3.5" />
              {t("lesson.readTheory")}
            </button>
          )}
          <NoteEditor
            value={text}
            label={title}
            mono={CODE_SECTIONS.has(sectionKey)}
            placeholder={t(`section.${sectionKey}.placeholder` as "section.idea.placeholder")}
            emptyText={t("section.empty")}
            onChange={(value) => notebookActions.setSection(pattern.id, sectionKey, value)}
          />
        </CollapsibleContent>
      </Collapsible>
    </Step>
  )
}

/**
 * The page of a DSA pattern, as a beginner's path: the theory in your own words first
 * (each note section read and edited in place), then an example with a guide and two
 * problems to solve alone, then the pitfalls hit on the way.
 */
export function PatternLesson({
  pattern,
  sectionOf,
}: {
  pattern: Pattern
  sectionOf: (key: string) => SectionTarget
}) {
  const { t } = useTranslation()
  const nb = useNotebook()
  const content = useContent()
  const lang = useLang()
  const titleId = useId()
  const lesson = patternLesson(content, nb, pattern, lang)
  const next = nextLessonStep(lesson)
  const theoryDone = lesson.checkpoints.filter((c) => c.done).length
  const solved = lesson.practice.filter((p) => p.done).length
  const finished = next === undefined && lesson.practice.length === PRACTICE_ROLES.length
  // The step to do next starts open; the rest stay closed until asked
  const [openKeys, setOpenKeys] = useState(
    () => new Set<string>(typeof next === "string" ? [next] : [])
  )
  const setOpen = (key: string) => (value: boolean) =>
    setOpenKeys((keys) => {
      const nextKeys = new Set(keys)
      if (value) nextKeys.add(key)
      else nextKeys.delete(key)
      return nextKeys
    })
  const [readingKey, setReadingKey] = useState<string | null>(null)
  const notes = [...lesson.checkpoints.map((c) => c.note), lesson.pitfalls]
  const reading = notes.find((note): note is SuggestedNote => note?.key === readingKey)

  function start(problem: PracticeProblem) {
    const id = problem.linked
      ? problem.id
      : notebookActions.addProblem({
          url: problem.url,
          title: problem.title,
          level: problem.level,
          patternIds: [pattern.id],
        })
    navigate(href.problem(id))
  }

  function practiceDetail(problem: PracticeProblem) {
    if (problem.role === "guided")
      return t("lesson.guidedDetail", {
        outcome: t("outcome.solution"),
        count: REDO_AFTER.solution,
      })
    if (problem.last) return t("lesson.soloRetry")
    return t("lesson.soloDetail", { minutes: THINK_MINUTES, steps: t("solve.title") })
  }

  return (
    <section aria-labelledby={titleId} className="rounded-md border bg-card">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b px-4 py-2.5">
        <h2 id={titleId} className="min-w-0 flex-1 text-15 font-semibold">
          {t("lesson.title")}
        </h2>
        <span className="font-mono text-12 text-muted-foreground">
          {t("lesson.progress", {
            theory: theoryDone,
            theoryTotal: CHECKPOINTS.length,
            solved,
            total: PRACTICE_ROLES.length,
          })}
        </span>
      </div>

      <div className="px-4 py-3">
        <h3 className={LABEL}>{t("lesson.theoryTitle")}</h3>
        <p className="mb-1 text-12 text-faint">{t("lesson.theoryIntro")}</p>
        <ol>
          <ExplainStep
            pattern={pattern}
            explain={lesson.explain}
            mark={<BookOpenIcon className="size-3" />}
            done={false}
            isNext={next === "explain"}
            open={openKeys.has("explain")}
            onOpenChange={setOpen("explain")}
          />
          {lesson.checkpoints.map((c, i) => (
            <NoteStep
              key={c.key}
              pattern={pattern}
              sectionKey={c.key}
              mark={i + 1}
              done={c.done}
              isNext={next === c.key}
              instruction={t(`lesson.checkpoint.${c.key}`)}
              note={c.note}
              guide={c.guide}
              quiz={c.key === "recognition" ? lesson.quiz : []}
              open={openKeys.has(c.key)}
              onOpenChange={setOpen(c.key)}
              onRead={() => setReadingKey(c.key)}
            />
          ))}
        </ol>

        <div className="mt-4 mb-1 flex flex-wrap items-baseline gap-x-2">
          <h3 className={LABEL}>{t("lesson.practiceTitle")}</h3>
          {theoryDone < CHECKPOINTS.length && (
            <span className="text-12 text-faint">{t("lesson.theoryFirst")}</span>
          )}
        </div>
        {lesson.practice.length === 0 ? (
          <p className="py-2 text-13 text-faint">
            {t("lesson.noProblems", { section: sectionOf("problems").title })}
          </p>
        ) : (
          <ol>
            {lesson.practice.map((p, i) => {
              const isNext = next === i
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t py-2 first:border-t-0"
                >
                  <StepMark done={p.done} next={isNext}>
                    {p.role === "guided" ? (
                      <BookOpenIcon className="size-3" />
                    ) : (
                      <CodeIcon className="size-3" />
                    )}
                  </StepMark>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-14">
                      <span className="font-mono text-12 text-muted-foreground max-sm:basis-full">
                        {practiceLabel(t, lesson.practice, i)}
                      </span>
                      <span className={cn("font-medium", p.done && "text-muted-foreground")}>
                        {p.title}
                      </span>
                      <LevelBadgeForProblemLevel level={p.level} />
                      {p.last && <ProblemStatusTag outcome={p.last} />}
                      {isNext && <Tag tone="link">{t("lesson.next")}</Tag>}
                    </p>
                    {isNext && <p className="text-13 text-muted-foreground">{practiceDetail(p)}</p>}
                  </div>
                  <Button
                    size="xs"
                    variant={isNext ? "default" : "outline"}
                    className="max-md:h-11"
                    onClick={() => start(p)}
                  >
                    {p.last
                      ? t("lesson.open")
                      : p.role === "guided"
                        ? t("lesson.learnFrom")
                        : t("lesson.solve")}
                  </Button>
                </li>
              )
            })}
          </ol>
        )}

        <ol className="mt-1 border-t">
          <NoteStep
            pattern={pattern}
            sectionKey="pitfalls"
            mark={<TriangleAlertIcon className="size-3" />}
            done={false}
            isNext={false}
            instruction={t("lesson.pitfallsHint")}
            note={lesson.pitfalls}
            guide={lesson.pitfallsGuide}
            open={openKeys.has("pitfalls")}
            onOpenChange={setOpen("pitfalls")}
            onRead={() => setReadingKey("pitfalls")}
          />
        </ol>
        {finished && (
          <p className="mt-2 border-t pt-2 text-13 text-muted-foreground">
            {t("lesson.finished", { n: GOT_IT_PROBLEMS, level: t("level.2") })}
          </p>
        )}
      </div>
      {reading && (
        <NoteDialog
          pattern={pattern}
          note={reading}
          open
          onOpenChange={(value) => !value && setReadingKey(null)}
        />
      )}
    </section>
  )
}
