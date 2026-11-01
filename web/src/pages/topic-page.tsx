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
  StarIcon,
  Trash2Icon,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { ContextMenu as ContextMenuPrimitive } from "radix-ui"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { LevelBar, LevelMeter, TopicDot } from "@/components/common/badges"
import { EditableText, InlineAdd, SELECT } from "@/components/common/editing"
import { PageHeader, Panel } from "@/components/common/page"
import { Tag } from "@/components/tag"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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

function interviewPriority(itemId: string): "must" | "important" | undefined {
  if (
    [
      "p1-hashing", "p1-prefix", "p1-matrix", "p1-twoptr", "p1-window", "p2-bsearch",
      "p2-stack", "p2-queue", "p2-stackq", "p2-list", "p2-fast-slow",
    ].includes(itemId)
  ) return "must"
  if (
    [
      "p3-tree", "p3-trees", "p3-tree-bfs", "p3-bst", "p3-graph", "p3-graphs",
      "p3-bfs-path", "p2-heap", "p2-two-heaps", "p2-kway", "p4-neet-dp", "p4-dp",
      "p4-lis", "p4-dp-strings", "p4-palindrome", "p4-dp-adv", "p4-dp-state",
    ].includes(itemId)
  ) return "important"
  return undefined
}

function PriorityStar({ priority }: { priority: "must" | "important" }) {
  const { t } = useTranslation()
  return (
    <span
      className="inline-flex shrink-0"
      title={t(`suggest.priority.${priority}`)}
      aria-label={t(`suggest.priority.${priority}`)}
    >
      <StarIcon
        aria-hidden
        className={cn("size-3.5", priority === "must" ? "fill-current text-amber-500" : "text-link")}
      />
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
  const [confirmDelete, setConfirmDelete] = useState(false)
  const priority = interviewPriority(pattern.sourceId ?? pattern.id.replace(/^pt_/, ""))
  return (
    <>
      <ContextMenuPrimitive.Root>
        <ContextMenuPrimitive.Trigger asChild>
          <li className="flex items-center gap-2.5 border-b px-3 py-2 last:border-b-0">
            <LevelMeter level={status.level} />
            {priority && <PriorityStar priority={priority} />}
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
        </ContextMenuPrimitive.Trigger>
        <ContextMenuPrimitive.Portal>
          <ContextMenuPrimitive.Content className="z-50 min-w-36 rounded-md bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
            <ContextMenuPrimitive.Item
              className="flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive outline-none select-none focus:bg-destructive/10"
              onSelect={() => setConfirmDelete(true)}
            >
              <Trash2Icon className="size-4" />
              {t("tree.deletePattern")}
            </ContextMenuPrimitive.Item>
          </ContextMenuPrimitive.Content>
        </ContextMenuPrimitive.Portal>
      </ContextMenuPrimitive.Root>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("pattern.deleteTitle", { name: pattern.name })}
        description={t("pattern.deleteText")}
        action={t("pattern.deleteAction")}
        destructive
        onConfirm={() => notebookActions.deletePattern(pattern.id)}
      />
    </>
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
  const [showAdded, setShowAdded] = useState(false)
  const phases = moduleSuggestions(module, nb, lang)
  const notAdded = (items: SuggestedItem[]) => items.filter((i) => !i.added).map((i) => i.itemId)
  const allLeft = notAdded(phases.flatMap((p) => p.items))
  const isVisible = (item: SuggestedItem) => showAdded || !item.added || interviewPriority(item.itemId)

  // One change for the lot, with Undo in case of a slip: what it added is still empty
  function addAll(itemIds: string[]) {
    const added = notebookActions.addSuggestedPatterns(content, itemIds, lang)
    if (!added.length) return
    toast.success(t("suggest.addedPatterns", { count: added.length }), {
      action: { label: t("suggest.undo"), onClick: () => notebookActions.deletePatterns(added) },
    })
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start py-3 text-left">
          <ListPlusIcon />
          {t("suggest.openRoadmap", { name: localize(module.title, lang) })}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90dvh] w-[89vw] max-w-[89vw] flex-col gap-4 overflow-hidden sm:max-w-[89vw] xl:max-w-[78rem]">
        <DialogHeader>
          <DialogTitle className="text-18 font-semibold">
            {t("suggest.title", { name: localize(module.title, lang) })}
          </DialogTitle>
          <DialogDescription>{t("suggest.roadmapIntro")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <Button variant={showAdded ? "secondary" : "outline"} onClick={() => setShowAdded((v) => !v)}>
            {showAdded ? t("suggest.hideAdded") : t("suggest.showAdded")}
          </Button>
          {allLeft.length > 0 && (
            <Button onClick={() => addAll(allLeft)}>
              <ListPlusIcon />
              {t("suggest.addAll", { count: allLeft.length })}
            </Button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {phases
            .filter((phase) => phase.items.some(isVisible))
            .map((phase, phaseIndex) => {
        const leftIds = notAdded(phase.items)
        const left = leftIds.length
        return (
          <Collapsible
            key={phase.phaseId}
            className="mb-3 overflow-hidden rounded-lg border bg-card last:mb-0"
            defaultOpen
          >
            <CollapsibleTrigger className="group/s flex w-full cursor-pointer items-center gap-3 bg-muted/50 px-4 py-3 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/s:rotate-90" />
              <span className="grid size-7 shrink-0 place-items-center rounded-full border bg-background font-mono text-12 text-muted-foreground">
                {phaseIndex + 1}
              </span>
              <span className="min-w-0 flex-1 text-14 font-semibold">{phase.name}</span>
              <span className="rounded-full border bg-background px-2.5 py-1 font-mono text-11 text-muted-foreground">
                {t("suggest.left", { count: left })}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {left > 0 && (
                <Button
                  size="xs"
                  variant="outline"
                  className="mx-4 mt-3 mb-1"
                  onClick={() => addAll(leftIds)}
                >
                  <ListPlusIcon />
                  {t("suggest.addPhase", { count: left })}
                </Button>
              )}
              <ul className="mt-2 border-t">
                {phase.items.filter(isVisible).map((item) => {
                  const priority = interviewPriority(item.itemId)
                  return (
                    <li
                      key={item.itemId}
                      className="flex items-center gap-3 border-b px-4 py-2.5 text-13 last:border-b-0 hover:bg-muted/20"
                    >
                    <span className="min-w-0 flex-1 font-medium leading-5">
                      {priority && <PriorityStar priority={priority} />}
                      {item.title}
                      <span className="ml-2 inline-flex rounded border bg-muted/40 px-1.5 py-0.5 align-middle font-mono text-10 font-normal text-muted-foreground">
                        {item.theory
                          ? t("pattern.theory")
                          : t("pattern.problemCount", { count: item.problems.length })}
                      </span>
                    </span>
                    {item.added ? (
                      <a
                        href={href.pattern(patternIdFor(item.itemId))}
                        className="shrink-0 rounded-full border border-ok/30 bg-ok/10 px-2.5 py-1 text-12 font-medium text-ok"
                      >
                        {t("suggest.added")}
                      </a>
                    ) : (
                      <Button
                        size="xs"
                        variant="outline"
                        className="shrink-0"
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
                  )
                })}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )
          })}
        </div>
      </DialogContent>
    </Dialog>
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
