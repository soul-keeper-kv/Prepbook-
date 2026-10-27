import { useEffect, useState, type ReactNode } from "react"
import { useNow } from "@/lib/clock"
import {
  ArrowUpDownIcon,
  ClipboardPasteIcon,
  FunnelIcon,
  ListPlusIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { LevelTag, OutcomeBar } from "@/components/common/badges"
import { ConflictList } from "@/components/common/conflicts"
import { EditableText, NoteEditor } from "@/components/common/editing"
import { FilterMenu, levelLabel, platformLabel } from "@/components/common/filter-menu"
import { Markdown } from "@/components/common/markdown"
import { DocSection, PageHeader, Panel } from "@/components/common/page"
import { CardList } from "@/components/pattern/card-list"
import { PatternLinks } from "@/components/pattern/pattern-links"
import { ProblemList, ProblemTableActions } from "@/components/pattern/problem-list"
import { orderLevelKeys, orderPlatformKeys } from "@/components/pattern/problem-table"
import { ResourceList } from "@/components/pattern/resource-list"
import { LABEL } from "@/components/section"
import { Tag } from "@/components/tag"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useContent } from "@/content/context"
import { localize } from "@/content/localize"
import { useLang, useNotebook } from "@/notebook/hooks"
import {
  DROP_AFTER_DAYS,
  GOT_IT_PROBLEMS,
  REVIEW_GAP_DAYS,
  getLive,
  patternStatus,
  phaseOfPattern,
  type PatternStatus,
} from "@/notebook/logic"
import type { Conflict, Pattern } from "@/notebook/schema"
import { notebookActions } from "@/notebook/store"
import {
  patternSuggestions,
  pickSuggestedProblems,
  withNote,
  type SuggestedNote,
} from "@/notebook/suggestions"
import { CODE_SECTIONS, SECTION_TEMPLATES } from "@/notebook/templates"
import { href, navigate } from "@/state/router"
import { SUGGEST_SORTS, uiActions, useUiStore, type SuggestSort } from "@/state/ui"
import { cn } from "@/lib/utils"

function MasteryStrip({ pattern, status }: { pattern: Pattern; status: PatternStatus }) {
  const { t } = useTranslation()
  const sentence = pattern.theory
    ? t(`mastery.theory.${status.level}`)
    : t(`mastery.practice.${status.level}`, {
        alone: status.aloneSolved,
        reviewed: status.reviewedAlone,
        need: GOT_IT_PROBLEMS,
        gap: REVIEW_GAP_DAYS,
      })
  return (
    <div className="mt-4 rounded-md border bg-background px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <LevelTag level={status.level} />
        <p className="min-w-0 flex-1 text-14">{sentence}</p>
        {!pattern.theory && (
          <span className="font-mono text-12 text-muted-foreground">
            {t("pattern.problemCount", { count: status.problems })}
          </span>
        )}
      </div>
      {!pattern.theory && status.problems > 0 && (
        <div className="mt-2.5">
          <OutcomeBar counts={status.outcomes} />
        </div>
      )}
      {status.overdue > DROP_AFTER_DAYS ? (
        <p className="mt-2 text-13 text-warn">{t("mastery.dropped", { days: status.overdue })}</p>
      ) : status.due > 0 ? (
        <p className="mt-2 text-13 text-warn">{t("mastery.due", { count: status.due })}</p>
      ) : null}
      {pattern.theory && (
        <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-14">
          <Checkbox
            checked={Boolean(pattern.done)}
            onCheckedChange={(checked) =>
              notebookActions.updatePattern(pattern.id, { done: checked === true })
            }
          />
          {t("pattern.theoryDone")}
        </label>
      )}
    </div>
  )
}

/** One suggested note: read it in a dialog, then copy it below what the section already has */
function NoteSuggestion({ pattern, note }: { pattern: Pattern; note: SuggestedNote }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const section = t(`section.${note.key}.title` as "section.idea.title")
  // Suggested pitfalls are common ones; the section is for the user's own
  const label = note.key === "pitfalls" ? t("suggest.pitfallsLabel") : section

  function copy() {
    const before = pattern.sections[note.key] ?? ""
    notebookActions.setSection(pattern.id, note.key, withNote(before, note.text))
    setOpen(false)
    toast.success(t("suggest.noteCopiedTo", { section }), {
      action: {
        label: t("suggest.undo"),
        onClick: () => notebookActions.setSection(pattern.id, note.key, before),
      },
    })
  }

  return (
    <li className="flex items-center gap-2 border-t py-1.5 text-13">
      <button
        type="button"
        className="min-w-0 flex-1 cursor-pointer truncate rounded-sm text-left text-link outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      {note.copied ? (
        <Tag tone="ok">{t("suggest.noteCopied")}</Tag>
      ) : (
        <Button
          size="xs"
          variant="outline"
          aria-label={t("suggest.copyNamed", { name: label })}
          onClick={copy}
        >
          <ClipboardPasteIcon />
          {t("suggest.copy")}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        {/* Only the note scrolls: the title and the Copy button stay in view on a phone */}
        <DialogContent className="flex max-h-[85vh] flex-col gap-4 rounded-lg border border-border-strong bg-card ring-0 sm:max-w-180">
          <DialogHeader>
            <DialogTitle className="text-15 font-semibold">
              {t("suggest.noteTitle", { name: label })}
            </DialogTitle>
            <DialogDescription className="text-13">
              {t("suggest.noteHint", { section })}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto text-14">
            <Markdown text={note.text} />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("suggest.close")}</Button>
            </DialogClose>
            {!note.copied && (
              <Button onClick={copy}>
                <ClipboardPasteIcon />
                {t("suggest.copy")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  )
}

const SORT_LABEL = {
  order: "suggest.sortOrder",
  level: "suggest.sortLevel",
  platform: "suggest.sortPlatform",
} as const

/** Above the suggested problems: platform and level filters, and their order */
function SuggestionTools({
  platforms,
  levels,
  children,
}: {
  platforms: Map<string, number>
  levels: Map<string, number>
  children: ReactNode
}) {
  const { t } = useTranslation()
  const filters = useUiStore((s) => s.suggestFilters)
  const sort = useUiStore((s) => s.suggestSort)
  // Filters are shared by every pattern: a value chosen elsewhere stays offered, to untick it
  const menu = (kind: "platform" | "level", counts: Map<string, number>) => {
    const keys = [...counts.keys(), ...filters[kind]]
    const ordered = kind === "platform" ? orderPlatformKeys(keys) : orderLevelKeys(keys)
    const name = t(kind === "platform" ? "suggest.platform" : "suggest.level")
    const selected = filters[kind]
    return (
      <FilterMenu
        options={ordered.map((key) => ({
          key,
          label: kind === "platform" ? platformLabel(key, t) : levelLabel(key, t),
          count: counts.get(key) ?? 0,
        }))}
        selected={selected}
        onChange={(keys) => uiActions.setSuggestFilter(kind, keys)}
        clearLabel={t("problem.filterClear")}
        trigger={
          <Button
            size="xs"
            variant="outline"
            className={cn("max-md:h-11", selected.length > 0 && "text-link")}
          >
            <FunnelIcon className={cn(selected.length > 0 && "fill-current")} />
            {selected.length ? t("suggest.filterCount", { name, count: selected.length }) : name}
          </Button>
        }
      />
    )
  }

  return (
    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
      {menu("platform", platforms)}
      {menu("level", levels)}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="xs"
            variant="outline"
            className={cn("max-md:h-11", sort !== "order" && "text-link")}
          >
            <ArrowUpDownIcon />
            {t("suggest.sort")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-48">
          <DropdownMenuRadioGroup
            value={sort}
            onValueChange={(value) => uiActions.setSuggestSort(value as SuggestSort)}
          >
            {SUGGEST_SORTS.map((key) => (
              <DropdownMenuRadioItem key={key} value={key} className="text-13">
                {t(SORT_LABEL[key])}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {children && (
        <span className="flex items-center gap-1 text-12 text-muted-foreground">
          {children}
          <Button
            size="xs"
            variant="ghost"
            className="max-md:h-11"
            onClick={() => {
              uiActions.setSuggestFilter("platform", [])
              uiActions.setSuggestFilter("level", [])
            }}
          >
            <XIcon />
            {t("problem.filterClear")}
          </Button>
        </span>
      )}
    </div>
  )
}

function PatternSuggestions({ pattern }: { pattern: Pattern }) {
  const { t } = useTranslation()
  const content = useContent()
  const nb = useNotebook()
  const lang = useLang()
  const filters = useUiStore((s) => s.suggestFilters)
  const sort = useUiStore((s) => s.suggestSort)
  const { module, notes, problems, resources } = patternSuggestions(content, nb, pattern, lang)
  if (!module || (!notes.length && !problems.length && !resources.length)) return null
  const { shown, platforms, levels } = pickSuggestedProblems(problems, filters, sort)
  const filtered = filters.platform.length + filters.level.length > 0
  // "Add all" adds what the filters show
  const items = shown.length + resources.length

  // Every suggested problem and link in one change, with Undo
  function addAll() {
    const problemIds = notebookActions.addProblems(
      shown.map((p) => ({
        url: p.url,
        title: p.title,
        level: p.level,
        patternIds: [pattern.id],
      }))
    )
    const resourceIds = notebookActions.addResources(
      resources.map((r) => ({ url: r.url, title: r.title, kind: r.kind, patternIds: [pattern.id] }))
    )
    toast.success(t("suggest.addedItems", { count: problemIds.length + resourceIds.length }), {
      action: {
        label: t("suggest.undo"),
        onClick: () => {
          notebookActions.unlinkProblems(problemIds, pattern.id)
          notebookActions.unlinkResources(resourceIds, pattern.id)
        },
      },
    })
  }

  return (
    <Panel
      title={t("suggest.title", { name: localize(module.title, lang) })}
      actions={
        items > 0 && (
          <Button size="xs" onClick={addAll}>
            <ListPlusIcon />
            {t("suggest.addAll", { count: items })}
          </Button>
        )
      }
    >
      <p className="mb-2 text-12 text-faint">{t("suggest.patternIntro")}</p>
      {notes.length > 0 && (
        <>
          <h3 className={cn(LABEL, "mt-3 mb-1")}>{t("suggest.notesTitle")}</h3>
          <ul className={cn(items > 0 && "mb-3")}>
            {notes.map((note) => (
              <NoteSuggestion key={note.key} pattern={pattern} note={note} />
            ))}
          </ul>
        </>
      )}
      {items > 0 && notes.length > 0 && (
        <h3 className={cn(LABEL, "mb-1")}>{t("suggest.itemsTitle")}</h3>
      )}
      {problems.length > 1 && (
        <SuggestionTools platforms={platforms} levels={levels}>
          {filtered && t("problem.filterShown", { shown: shown.length, total: problems.length })}
        </SuggestionTools>
      )}
      {problems.length > 0 && shown.length === 0 && (
        <p className="border-t py-2 text-13 text-faint">{t("problem.filterEmpty")}</p>
      )}
      {shown.length > 0 && (
        <ul className="mb-2">
          {shown.map((p) => (
            <li key={p.url} className="flex items-center gap-2 border-t py-1.5 text-13">
              <div className="min-w-0 flex-1">
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate"
                >
                  {p.title}
                </a>
                <span className="block font-mono text-11 text-faint">
                  {platformLabel(p.platform, t)}
                  {p.level && ` · ${p.level}`}
                </span>
              </div>
              <Button
                size="xs"
                variant="outline"
                aria-label={t("suggest.addNamed", { name: p.title })}
                onClick={() =>
                  notebookActions.addProblem({
                    url: p.url,
                    title: p.title,
                    level: p.level,
                    patternIds: [pattern.id],
                  })
                }
              >
                <PlusIcon />
                {t("suggest.add")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {resources.length > 0 && (
        <ul>
          {resources.map((r) => (
            <li key={r.url} className="flex items-center gap-2 border-t py-1.5 text-13">
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate"
              >
                {r.title}
              </a>
              <Button
                size="xs"
                variant="outline"
                aria-label={t("suggest.addNamed", { name: r.title })}
                onClick={() =>
                  notebookActions.addResource({
                    url: r.url,
                    title: r.title,
                    kind: r.kind,
                    patternIds: [pattern.id],
                  })
                }
              >
                <PlusIcon />
                {t("suggest.add")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function PatternPage({ id }: { id: string }) {
  const { t } = useTranslation()
  const nb = useNotebook()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const now = useNow()
  useEffect(() => uiActions.setLastPattern(id), [id])
  const pattern = getLive(nb.patterns, id)
  const topic = getLive(nb.topics, pattern?.topicId)
  if (!pattern || !topic) {
    return (
      <PageHeader title={t("notFound.title")}>
        <p className="mt-2 text-14">
          <a href={href.today}>{t("notFound.back")}</a>
        </p>
      </PageHeader>
    )
  }
  const status = patternStatus(nb, pattern, now)
  const phase = getLive(nb.phases, phaseOfPattern(nb, pattern))
  const sections = SECTION_TEMPLATES[topic.kind]
  const sectionTitle = (key: string) => t(`section.${key}.title` as "section.idea.title")
  const fieldLabel = (c: Conflict) =>
    c.field.startsWith("sections.") ? sectionTitle(c.field.slice("sections.".length)) : c.field
  const after = sections.length + (pattern.theory ? 0 : 1)

  return (
    <>
      <PageHeader
        crumbs={[
          { label: topic.name, href: href.topic(topic.id) },
          ...(phase ? [{ label: phase.name }] : []),
        ]}
        docTitle={pattern.name}
        title={
          <EditableText
            value={pattern.name}
            label={t("pattern.name")}
            onSave={(name) => notebookActions.updatePattern(pattern.id, { name })}
          />
        }
        actions={
          <>
            <label className="flex cursor-pointer items-center gap-2 text-13 text-muted-foreground">
              <Checkbox
                checked={pattern.theory}
                onCheckedChange={(checked) =>
                  notebookActions.updatePattern(pattern.id, { theory: checked === true })
                }
              />
              {t("pattern.theoryToggle")}
            </label>
            <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2Icon />
              {t("pattern.delete")}
            </Button>
          </>
        }
      >
        <MasteryStrip pattern={pattern} status={status} />
      </PageHeader>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("pattern.deleteTitle", { name: pattern.name })}
        description={t("pattern.deleteText")}
        action={t("pattern.deleteAction")}
        destructive
        onConfirm={() => {
          notebookActions.deletePattern(pattern.id)
          navigate(href.topic(topic.id))
        }}
      />

      <ConflictList entityIds={[pattern.id]} fieldLabel={fieldLabel} />

      <div className="flex flex-wrap items-start gap-8">
        <article className="min-w-0 flex-[999_1_520px] space-y-6">
          {sections.map((key, i) => (
            <DocSection
              key={key}
              title={`${i + 1}. ${sectionTitle(key)}`}
              hint={t(`section.${key}.hint` as "section.idea.hint")}
            >
              <NoteEditor
                value={pattern.sections[key] ?? ""}
                label={sectionTitle(key)}
                mono={CODE_SECTIONS.has(key)}
                placeholder={t(`section.${key}.placeholder` as "section.idea.placeholder")}
                emptyText={t("section.empty")}
                onChange={(text) => notebookActions.setSection(pattern.id, key, text)}
              />
            </DocSection>
          ))}
          {!pattern.theory && (
            <DocSection
              id="problems"
              title={`${sections.length + 1}. ${t("pattern.problems")}`}
              hint={t("pattern.problemsHint")}
              actions={<ProblemTableActions pattern={pattern} />}
            >
              <ProblemList pattern={pattern} now={now} />
            </DocSection>
          )}
          <DocSection
            title={`${after + 1}. ${t("pattern.resources")}`}
            hint={t("pattern.resourcesHint")}
          >
            <ResourceList pattern={pattern} />
          </DocSection>
          <DocSection title={`${after + 2}. ${t("pattern.cards")}`} hint={t("pattern.cardsHint")}>
            <CardList pattern={pattern} now={now} />
          </DocSection>
        </article>

        <aside className="flex min-w-0 flex-[1_1_280px] flex-col gap-4 lg:sticky lg:top-6">
          <Panel>
            <div className="space-y-4">
              <PatternLinks
                pattern={pattern}
                field="requires"
                title={t("pattern.requires")}
                emptyText={t("pattern.requiresEmpty")}
              />
              <PatternLinks
                pattern={pattern}
                field="related"
                title={t("pattern.related")}
                emptyText={t("pattern.relatedEmpty")}
              />
            </div>
          </Panel>
          <PatternSuggestions pattern={pattern} />
        </aside>
      </div>
    </>
  )
}
