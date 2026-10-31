import { useId, useState } from "react"
import { useNow } from "@/lib/clock"
import { ChevronRightIcon, ExternalLinkIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { CodeBlock } from "@/components/code-block"
import { ConfirmDialog } from "@/components/confirm-dialog"
import {
  LevelBadgeForProblemLevel,
  OutcomeTag,
  ProblemStatusTag,
  TopicDot,
} from "@/components/common/badges"
import { ConflictList } from "@/components/common/conflicts"
import { EditableText, FIELD, NoteEditor, SELECT, insertTab } from "@/components/common/editing"
import { BackButton, PageHeader, Panel } from "@/components/common/page"
import { PatternPicker } from "@/components/common/pattern-picker"
import { AttemptForm } from "@/components/problem/attempt-form"
import { ProblemHelp } from "@/components/problem/problem-help"
import { practiceLabel } from "@/components/pattern/pattern-lesson"
import { ProblemPager } from "@/components/problem/problem-pager"
import { SolveSteps } from "@/components/problem/solve-steps"
import { Tag } from "@/components/tag"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Textarea } from "@/components/ui/textarea"
import { formatDate, formatTime, dueText } from "@/lib/time"
import { cn } from "@/lib/utils"
import { useContent } from "@/content/context"
import { THINK_MINUTES } from "@/content/problems"
import { useLang, useNotebook } from "@/notebook/hooks"
import { patternLesson } from "@/notebook/lesson"
import { attemptsOf, getLive, isDue, problemSchedule } from "@/notebook/logic"
import type { Attempt, Conflict, Problem } from "@/notebook/schema"
import { notebookActions } from "@/notebook/store"
import { PROBLEM_LEVELS } from "@/pages/inbox-page"
import { href, navigate } from "@/state/router"
import { useUiStore } from "@/state/ui"

function AttemptCode({ attempt }: { attempt: Attempt }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  if (editing) {
    const setCode = (code: string) => notebookActions.updateAttempt(attempt.id, { code })
    return (
      <div className="space-y-1.5">
        <Textarea
          autoFocus
          aria-label={t("attempt.code")}
          className={cn(FIELD, "min-h-40 font-mono text-13 leading-[1.6] [tab-size:4] md:text-13")}
          wrap="off"
          spellCheck={false}
          value={attempt.code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => insertTab(e, setCode)}
        />
        <Button size="xs" variant="outline" onClick={() => setEditing(false)}>
          {t("edit.done")}
        </Button>
      </div>
    )
  }
  return (
    <div className="space-y-1.5">
      {attempt.code.trim() ? (
        <div className="overflow-hidden rounded-md border">
          <CodeBlock code={attempt.code} lang={attempt.lang} />
        </div>
      ) : (
        <p className="text-13 text-faint">{t("attempt.noCode")}</p>
      )}
      <Button size="xs" variant="outline" onClick={() => setEditing(true)}>
        <PencilIcon />
        {attempt.code.trim() ? t("attempt.editCode") : t("attempt.addCode")}
      </Button>
    </div>
  )
}

function AttemptItem({ attempt }: { attempt: Attempt }) {
  const { t } = useTranslation()
  const lang = useLang()
  const [confirm, setConfirm] = useState(false)
  return (
    <li className="border-b py-3 last:border-b-0">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className="font-mono text-12 text-muted-foreground">
          {attempt.imported
            ? t("attempt.importedOn", { date: formatDate(attempt.at, lang) })
            : `${formatDate(attempt.at, lang)} ${formatTime(attempt.at, lang)}`}
        </span>
        <OutcomeTag outcome={attempt.outcome} />
        {attempt.minutes !== null && (
          <span className="font-mono text-12 text-muted-foreground">
            {t("duration.minutes", { count: attempt.minutes })}
          </span>
        )}
        {attempt.mistakes.map((m) => (
          <Tag key={m} tone="danger">
            {t(`mistake.${m}` as "mistake.edge")}
          </Tag>
        ))}
        <Button
          size="icon-xs"
          variant="ghost"
          className="ml-auto"
          aria-label={t("attempt.delete")}
          onClick={() => setConfirm(true)}
        >
          <Trash2Icon />
        </Button>
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title={t("attempt.deleteTitle")}
          description={t("attempt.deleteText")}
          action={t("attempt.deleteAction")}
          destructive
          onConfirm={() => notebookActions.deleteAttempt(attempt.id)}
        />
      </div>
      {!attempt.imported && (
        <div className="space-y-2.5 pl-0.5">
          <NoteEditor
            value={attempt.note}
            label={t("attempt.note")}
            placeholder={t("attempt.notePlaceholder")}
            emptyText={t("attempt.noNote")}
            onChange={(note) => notebookActions.updateAttempt(attempt.id, { note })}
          />
          <AttemptCode attempt={attempt} />
        </div>
      )}
    </li>
  )
}

function ProblemPatterns({ problem }: { problem: Problem }) {
  const { t } = useTranslation()
  const nb = useNotebook()
  const [editing, setEditing] = useState(false)
  const patterns = problem.patternIds
    .map((id) => getLive(nb.patterns, id))
    .filter((p) => p !== undefined)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-13 text-muted-foreground">{t("problem.patterns")}</span>
      {patterns.map((p) => {
        const topic = getLive(nb.topics, p.topicId)
        return (
          <a
            key={p.id}
            href={href.pattern(p.id)}
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-13"
          >
            {topic && <TopicDot color={topic.color} />}
            {p.name}
          </a>
        )
      })}
      <Button
        size="xs"
        variant="ghost"
        aria-expanded={editing}
        onClick={() => setEditing((e) => !e)}
      >
        <PencilIcon />
        {editing ? t("edit.done") : t("problem.editPatterns")}
      </Button>
      {editing && (
        <div className="basis-full">
          <PatternPicker
            label={t("problem.patterns")}
            value={problem.patternIds}
            onChange={(ids) => {
              const added = ids.filter((id) => !problem.patternIds.includes(id))
              const removed = problem.patternIds.filter((id) => !ids.includes(id))
              for (const id of added) notebookActions.linkProblem(problem.id, id)
              // Keep it in one pattern at least: deleting is its own button
              if (ids.length)
                for (const id of removed) notebookActions.unlinkProblem(problem.id, id)
            }}
          />
        </div>
      )}
    </div>
  )
}

export function ProblemPage({ id }: { id: string }) {
  const { t } = useTranslation()
  const nb = useNotebook()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const now = useNow()
  const levelId = useId()
  const content = useContent()
  const lang = useLang()
  const lastPatternId = useUiStore((s) => s.lastPatternId)
  const problem = getLive(nb.problems, id)
  if (!problem) {
    return (
      <PageHeader title={t("notFound.title")}>
        <p className="mt-2 text-14">
          <a href={href.today}>{t("notFound.back")}</a>
        </p>
      </PageHeader>
    )
  }
  const attempts = attemptsOf(nb, problem.id)
  const { dueAt, last } = problemSchedule(attempts)
  const patterns = problem.patternIds
    .map((pid) => getLive(nb.patterns, pid))
    .filter((p) => p !== undefined)
  // The breadcrumb and the pager follow the pattern the problem was opened from
  const pattern = patterns.find((p) => p.id === lastPatternId) ?? patterns[0]
  const topic = getLive(nb.topics, pattern?.topicId)
  const patternNames = patterns.map((p) => p.name).join(", ")
  // Its part in that pattern's lesson: the guided example, or one to solve alone
  const practice =
    pattern && topic?.kind === "dsa" && !pattern.theory
      ? patternLesson(content, nb, pattern, lang).practice
      : []
  const practiceIndex = practice.findIndex((p) => p.id === problem.id)
  const guided = practice[practiceIndex]?.role === "guided"
  const conflictLabel = (c: Conflict) =>
    c.entityId === problem.id
      ? t("problem.notes")
      : t(`conflict.field.${c.field}` as "conflict.field.note")

  return (
    <>
      <PageHeader
        crumbs={[
          ...(topic ? [{ label: topic.name, href: href.topic(topic.id) }] : []),
          ...(pattern ? [{ label: pattern.name, href: href.pattern(pattern.id) }] : []),
        ]}
        back={<BackButton fallback={pattern ? href.pattern(pattern.id) : href.today} />}
        pager={pattern && <ProblemPager problem={problem} pattern={pattern} />}
        docTitle={problem.title}
        title={
          <EditableText
            value={problem.title}
            label={t("problem.title")}
            onSave={(title) => notebookActions.updateProblem(problem.id, { title })}
          />
        }
        actions={
          <>
            <Button asChild variant="outline">
              <a
                href={problem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="no-underline hover:no-underline"
              >
                {t("problem.open")}
                <ExternalLinkIcon />
              </a>
            </Button>
            <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2Icon />
              {t("problem.delete")}
            </Button>
          </>
        }
      >
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <ProblemStatusTag outcome={last?.outcome ?? "todo"} />
            {last && (
              <>
                <span className="font-mono text-12 text-muted-foreground">
                  {t("problem.attemptCount", { count: attempts.length })}
                </span>
                <span className={cn("text-14", isDue(dueAt, now) && "font-semibold text-warn")}>
                  {t("problem.redo", { when: dueText(dueAt, t, now) })}
                </span>
              </>
            )}
          </span>
          <span className="flex items-center gap-2">
            <label htmlFor={levelId} className="text-13 text-muted-foreground">
              {t("problem.level")}
            </label>
            <select
              id={levelId}
              className={SELECT}
              value={problem.level}
              onChange={(e) => notebookActions.updateProblem(problem.id, { level: e.target.value })}
            >
              <option value="">—</option>
              {PROBLEM_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {t(`problemLevel.${l}`)}
                </option>
              ))}
            </select>
            <LevelBadgeForProblemLevel level={problem.level} />
          </span>
        </div>
        <div className="mt-3">
          <ProblemPatterns problem={problem} />
        </div>
        {pattern && practiceIndex >= 0 && (
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-13 text-muted-foreground">
            <Tag tone="link">{practiceLabel(t, practice, practiceIndex)}</Tag>
            {guided
              ? t("lesson.guidedHere", { pattern: pattern.name, help: t("help.toggle") })
              : t("lesson.soloHere", { pattern: pattern.name, minutes: THINK_MINUTES })}
          </p>
        )}
      </PageHeader>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("problem.deleteTitle", { name: problem.title })}
        description={t("problem.deleteText")}
        action={t("problem.deleteAction")}
        destructive
        onConfirm={() => {
          notebookActions.deleteProblem(problem.id)
          navigate(pattern ? href.pattern(pattern.id) : href.today)
        }}
      />

      <ConflictList
        entityIds={[problem.id, ...attempts.map((a) => a.id)]}
        fieldLabel={conflictLabel}
      />

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
          <SolveSteps />
          <Panel title={t("attempt.title")}>
            <AttemptForm key={problem.id} problemId={problem.id} />
          </Panel>
          <Panel title={t("attempt.history", { count: attempts.length })}>
            {attempts.length ? (
              <ul className="-my-1">
                {[...attempts].reverse().map((a) => (
                  <AttemptItem key={a.id} attempt={a} />
                ))}
              </ul>
            ) : (
              <p className="text-14 text-faint">{t("attempt.none")}</p>
            )}
          </Panel>
        </div>
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-5">
          <Panel title={t("problem.notes")}>
            <NoteEditor
              value={problem.notes}
              label={t("problem.notes")}
              placeholder={t("problem.notesPlaceholder")}
              emptyText={t("problem.notesEmpty")}
              onChange={(notes) => notebookActions.updateProblem(problem.id, { notes })}
            />
          </Panel>
          {/* A guided example opens on the step-by-step explanation */}
          <Collapsible
            key={`${problem.id}-${guided}`}
            defaultOpen={guided}
            className="rounded-md border bg-card"
          >
            <CollapsibleTrigger className="group/h flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left text-14 font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ChevronRightIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]/h:rotate-90" />
              {t("help.toggle")}
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t px-4 py-3">
              <ProblemHelp
                problem={problem}
                patternNames={patternNames}
                initialMode={guided ? "explain" : undefined}
              />
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </>
  )
}
