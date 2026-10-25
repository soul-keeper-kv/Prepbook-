import { useState } from "react"
import { useNow } from "@/lib/clock"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { LevelTag, OutcomeBar } from "@/components/common/badges"
import { ConflictList } from "@/components/common/conflicts"
import { EditableText, NoteEditor } from "@/components/common/editing"
import { DocSection, PageHeader, Panel } from "@/components/common/page"
import { CardList } from "@/components/pattern/card-list"
import { PatternLinks } from "@/components/pattern/pattern-links"
import { ProblemList } from "@/components/pattern/problem-list"
import { ResourceList } from "@/components/pattern/resource-list"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useContent } from "@/content/context"
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
import { patternSuggestions } from "@/notebook/suggestions"
import { CODE_SECTIONS, SECTION_TEMPLATES } from "@/notebook/templates"
import { href, navigate } from "@/state/router"

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

function PatternSuggestions({ pattern }: { pattern: Pattern }) {
  const { t } = useTranslation()
  const content = useContent()
  const nb = useNotebook()
  const lang = useLang()
  const { problems, resources } = patternSuggestions(content, nb, pattern, lang)
  if (!pattern.sourceId || (!problems.length && !resources.length)) return null
  return (
    <Panel title={t("suggest.title")}>
      <p className="mb-2 text-12 text-faint">{t("suggest.patternIntro")}</p>
      {problems.length > 0 && (
        <ul className="mb-2">
          {problems.map((p) => (
            <li key={p.url} className="flex items-center gap-2 border-t py-1.5 text-13">
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate"
              >
                {p.title}
              </a>
              {p.level && <span className="font-mono text-11 text-faint">{p.level}</span>}
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
