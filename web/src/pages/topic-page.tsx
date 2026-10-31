import { useId, useState } from "react"
import { useNow } from "@/lib/clock"
import {
  ArrowDownIcon,
  ListPlusIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronRightIcon,
  PlusIcon,
  SettingsIcon,
  Trash2Icon,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { LevelBar, LevelMeter, TopicDot } from "@/components/common/badges"
import { EditableText, InlineAdd, SELECT } from "@/components/common/editing"
import { PageHeader, Panel } from "@/components/common/page"
import { Tag } from "@/components/tag"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useContent } from "@/content/context"
import { modulesOf, type Module } from "@/content/load"
import { localize } from "@/content/localize"
import { cn } from "@/lib/utils"
import { useLang, useNotebook, useSamples } from "@/notebook/hooks"
import {
  getLive,
  patternStatus,
  patternsOf,
  phasesOf,
  topicStatus,
  type PatternStatus,
} from "@/notebook/logic"
import { TOPIC_COLORS, TOPIC_KINDS, type Pattern, type Phase, type Topic } from "@/notebook/schema"
import { notebookActions } from "@/notebook/store"
import {
  moduleSuggestions,
  patternIdFor,
  samplesFrom,
  type SuggestedItem,
} from "@/notebook/suggestions"
import { href, navigate } from "@/state/router"

function MoveButtons({
  index,
  count,
  name,
  onMove,
}: {
  index: number
  count: number
  name: string
  onMove: (index: number) => void
}) {
  const { t } = useTranslation()
  return (
    <span className="flex">
      <Button
        variant="ghost"
        size="icon-xs"
        disabled={index === 0}
        aria-label={t("edit.moveUp", { name })}
        onClick={() => onMove(index - 1)}
      >
        <ArrowUpIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        disabled={index === count - 1}
        aria-label={t("edit.moveDown", { name })}
        onClick={() => onMove(index + 1)}
      >
        <ArrowDownIcon />
      </Button>
    </span>
  )
}

function PatternRow({
  pattern,
  status,
  index,
  count,
  onMove,
}: {
  pattern: Pattern
  status: PatternStatus
  index: number
  count: number
  onMove: (index: number) => void
}) {
  const { t } = useTranslation()
  return (
    <li className="flex items-center gap-2.5 border-b px-3 py-2 last:border-b-0">
      <LevelMeter level={status.level} />
      <a href={href.pattern(pattern.id)} className="min-w-0 flex-1 truncate font-medium">
        {pattern.name}
      </a>
      {pattern.theory && <Tag tone="link">{t("pattern.theory")}</Tag>}
      {status.due > 0 && <Tag tone="warn">{t("pattern.due", { count: status.due })}</Tag>}
      <span className="font-mono text-12 text-muted-foreground max-sm:hidden">
        {pattern.theory
          ? t(`level.${status.level}`)
          : t("pattern.problemCount", { count: status.problems })}
      </span>
      <MoveButtons index={index} count={count} name={pattern.name} onMove={onMove} />
    </li>
  )
}

function PhaseBlock({
  topic,
  phase,
  index,
  count,
  last,
}: {
  topic: Topic
  phase: Phase | null
  index: number
  count: number
  last: boolean
}) {
  const { t } = useTranslation()
  const nb = useNotebook()
  const now = useNow()
  const samples = useSamples()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const patterns = patternsOf(nb, topic.id, phase?.id ?? null)
  const statuses = patterns.map((p) => patternStatus(nb, p, now, samples))
  const gotIt = statuses.filter((s) => s.level >= 2).length
  const started = statuses.some((s) => s.level >= 1)
  const complete = patterns.length > 0 && gotIt === patterns.length

  return (
    <li className="flex gap-4">
      <div className="flex w-7 shrink-0 flex-col items-center" aria-hidden>
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full border-2 font-mono text-12",
            complete
              ? "border-link bg-link text-primary-foreground"
              : started
                ? "border-link bg-card"
                : "border-border-strong bg-card text-muted-foreground"
          )}
        >
          {complete ? (
            <CheckIcon className="size-3.5 stroke-3" />
          ) : started ? (
            <span className="size-2.5 rounded-full bg-link" />
          ) : phase ? (
            index + 1
          ) : (
            "·"
          )}
        </span>
        {!last && <span className={cn("w-0.5 flex-1", complete ? "bg-link" : "bg-border")} />}
      </div>
      <div className="min-w-0 flex-1 pb-7">
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          {phase ? (
            <EditableText
              className="min-w-0 flex-1 text-15 font-semibold"
              value={phase.name}
              label={t("phase.name")}
              onSave={(name) => notebookActions.renamePhase(phase.id, name)}
            />
          ) : (
            <span className="flex-1 text-15 font-semibold">{t("phase.none")}</span>
          )}
          <span className="font-mono text-12 text-muted-foreground">
            {t("phase.progress", { done: gotIt, total: patterns.length })}
          </span>
          {phase && (
            <>
              <MoveButtons
                index={index}
                count={count}
                name={phase.name}
                onMove={(to) => notebookActions.movePhase(phase.id, to)}
              />
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t("phase.delete", { name: phase.name })}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2Icon />
              </Button>
              <ConfirmDialog
                open={confirmDelete}
                onOpenChange={setConfirmDelete}
                title={t("phase.deleteTitle", { name: phase.name })}
                description={t("phase.deleteText")}
                action={t("phase.deleteAction")}
                destructive
                onConfirm={() => notebookActions.deletePhase(phase.id)}
              />
            </>
          )}
        </div>
        {patterns.length > 0 && (
          <ul className="mb-2 rounded-md border bg-card">
            {patterns.map((pattern, i) => (
              <PatternRow
                key={pattern.id}
                pattern={pattern}
                status={statuses[i]!}
                index={i}
                count={patterns.length}
                onMove={(to) =>
                  notebookActions.movePattern(pattern.id, topic.id, phase?.id ?? null, to)
                }
              />
            ))}
          </ul>
        )}
        <InlineAdd
          label={t("pattern.add")}
          placeholder={t("pattern.namePlaceholder")}
          onAdd={(name) => notebookActions.addPattern(topic.id, phase?.id ?? null, name)}
        />
      </div>
    </li>
  )
}

function TopicSettings({ topic }: { topic: Topic }) {
  const { t } = useTranslation()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const kindId = useId()
  return (
    <Panel title={t("topic.settings")} className="mb-5">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="space-y-1">
          <label htmlFor={kindId} className="block text-13 font-medium">
            {t("topic.kind")}
          </label>
          <select
            id={kindId}
            className={SELECT}
            value={topic.kind}
            onChange={(e) =>
              notebookActions.updateTopic(topic.id, { kind: e.target.value as Topic["kind"] })
            }
          >
            {TOPIC_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`topicKind.${k}`)}
              </option>
            ))}
          </select>
        </div>
        <fieldset className="space-y-1">
          <legend className="text-13 font-medium">{t("topic.color")}</legend>
          <div className="flex gap-1">
            {TOPIC_COLORS.map((color) => (
              <label
                key={color}
                className={cn(
                  "grid size-8 cursor-pointer place-items-center rounded-sm border has-focus-visible:ring-2 has-focus-visible:ring-ring",
                  topic.color === color ? "border-foreground" : "border-transparent"
                )}
              >
                <input
                  type="radio"
                  name={`color-${topic.id}`}
                  className="sr-only"
                  checked={topic.color === color}
                  onChange={() => notebookActions.updateTopic(topic.id, { color })}
                  aria-label={t(`topicColor.${color}`)}
                />
                <TopicDot color={color} className="size-4" />
              </label>
            ))}
          </div>
        </fieldset>
        <Button variant="destructive" className="ml-auto" onClick={() => setConfirmDelete(true)}>
          <Trash2Icon />
          {t("topic.delete")}
        </Button>
      </div>
      <p className="mt-2 text-12 text-faint">{t("topic.kindHint")}</p>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("topic.deleteTitle", { name: topic.name })}
        description={t("topic.deleteText")}
        action={t("topic.deleteAction")}
        destructive
        onConfirm={() => {
          notebookActions.deleteTopic(topic.id)
          navigate(href.today)
        }}
      />
    </Panel>
  )
}

/** A module of data/, offered phase by phase: an item becomes a pattern only when added */
function Suggestions({ module }: { module: Module }) {
  const { t } = useTranslation()
  const content = useContent()
  const nb = useNotebook()
  const lang = useLang()
  const phases = moduleSuggestions(module, nb, lang)
  const notAdded = (items: SuggestedItem[]) => items.filter((i) => !i.added).map((i) => i.itemId)
  const allLeft = notAdded(phases.flatMap((p) => p.items))

  // One change for the lot, with Undo in case of a slip: what it added is still empty
  function addAll(itemIds: string[]) {
    const added = notebookActions.addSuggestedPatterns(content, itemIds, lang)
    if (!added.length) return
    toast.success(t("suggest.addedPatterns", { count: added.length }), {
      action: { label: t("suggest.undo"), onClick: () => notebookActions.deletePatterns(added) },
    })
  }

  return (
    <Panel
      title={t("suggest.title", { name: localize(module.title, lang) })}
      actions={
        allLeft.length > 0 && (
          <Button size="xs" onClick={() => addAll(allLeft)}>
            <ListPlusIcon />
            {t("suggest.addAll", { count: allLeft.length })}
          </Button>
        )
      }
    >
      <p className="mb-2 text-13 text-muted-foreground">{t("suggest.roadmapIntro")}</p>
      {phases.map((phase) => {
        const leftIds = notAdded(phase.items)
        const left = leftIds.length
        return (
          <Collapsible key={phase.phaseId} className="border-t">
            <CollapsibleTrigger className="group/s flex w-full cursor-pointer items-center gap-2 py-2 text-left text-13 outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/s:rotate-90" />
              <span className="min-w-0 flex-1 font-medium">{phase.name}</span>
              <span className="font-mono text-11 text-faint">
                {t("suggest.left", { count: left })}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {left > 0 && (
                <Button
                  size="xs"
                  variant="outline"
                  className="mb-1 ml-5"
                  onClick={() => addAll(leftIds)}
                >
                  <ListPlusIcon />
                  {t("suggest.addPhase", { count: left })}
                </Button>
              )}
              <ul className="pb-2">
                {phase.items.map((item) => (
                  <li key={item.itemId} className="flex items-center gap-2 py-1 pl-5 text-13">
                    <span className="min-w-0 flex-1">
                      {item.title}
                      <span className="ml-1.5 font-mono text-11 text-faint">
                        {item.theory
                          ? t("pattern.theory")
                          : t("pattern.problemCount", { count: item.problems.length })}
                      </span>
                    </span>
                    {item.added ? (
                      <a
                        href={href.pattern(patternIdFor(item.itemId))}
                        className="shrink-0 text-12"
                      >
                        {t("suggest.added")}
                      </a>
                    ) : (
                      <Button
                        size="xs"
                        variant="outline"
                        aria-label={t("suggest.addNamed", { name: item.title })}
                        onClick={() =>
                          notebookActions.addSuggestedPattern(content, item.itemId, lang)
                        }
                      >
                        <PlusIcon />
                        {t("suggest.add")}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </Panel>
  )
}

export function TopicPage({ id }: { id: string }) {
  const { t } = useTranslation()
  const nb = useNotebook()
  const [showSettings, setShowSettings] = useState(false)
  const now = useNow()
  const content = useContent()
  const topic = getLive(nb.topics, id)
  if (!topic) {
    return (
      <PageHeader title={t("notFound.title")}>
        <p className="mt-2 text-14">
          <a href={href.today}>{t("notFound.back")}</a>
        </p>
      </PageHeader>
    )
  }
  const modules = modulesOf(content, topic.id)
  const status = topicStatus(nb, topic.id, now, samplesFrom(content))
  const phases = phasesOf(nb, topic.id)
  const loose = patternsOf(nb, topic.id, null)

  return (
    <>
      <PageHeader
        crumbs={[{ label: t("nav.topics"), href: href.topics }]}
        docTitle={topic.name}
        title={
          <>
            <TopicDot color={topic.color} className="size-3" />
            <EditableText
              value={topic.name}
              label={t("topic.name")}
              onSave={(name) => notebookActions.updateTopic(topic.id, { name })}
            />
          </>
        }
        actions={
          <Button
            variant="outline"
            aria-expanded={showSettings}
            onClick={() => setShowSettings((s) => !s)}
          >
            <SettingsIcon />
            {t("topic.settings")}
          </Button>
        }
      >
        <div className="mt-3 max-w-160">
          <LevelBar byLevel={status.byLevel} />
          <p className="mt-1.5 font-mono text-12 text-muted-foreground">
            {t("topic.counts", {
              done: status.byLevel[2] + status.byLevel[3],
              total: status.total,
              solved: status.solvedAlone,
            })}
          </p>
        </div>
      </PageHeader>

      {showSettings && <TopicSettings topic={topic} />}

      <div className="flex flex-wrap items-start gap-6">
        <section aria-label={t("topic.roadmap")} className="min-w-0 flex-[999_1_480px]">
          <ol>
            {phases.map((phase, i) => (
              <PhaseBlock
                key={phase.id}
                topic={topic}
                phase={phase}
                index={i}
                count={phases.length}
                last={i === phases.length - 1 && loose.length === 0}
              />
            ))}
            {(loose.length > 0 || phases.length === 0) && (
              <PhaseBlock
                topic={topic}
                phase={null}
                index={phases.length}
                count={phases.length}
                last
              />
            )}
          </ol>
          <div className="mt-2 border-t pt-4">
            <InlineAdd
              label={t("phase.add")}
              placeholder={t("phase.namePlaceholder")}
              onAdd={(name) => notebookActions.addPhase(topic.id, name)}
            />
          </div>
        </section>
        {modules.length > 0 && (
          <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
            {modules.map((module) => (
              <Suggestions key={module.id} module={module} />
            ))}
          </aside>
        )}
      </div>
    </>
  )
}
