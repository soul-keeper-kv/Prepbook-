import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { InlineText, plainText } from "@/components/inline-text"
import { ResourceList } from "@/components/detail/resource-list"
import { Segmented } from "@/components/segmented"
import { EmptyNote, LABEL, LINK_ROW, Section } from "@/components/section"
import { Tag, levelTone } from "@/components/tag"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { codeLangLabel } from "@/content/code-langs"
import { useLocalize } from "@/content/localize"
import { AI_MODES, AI_TOOLS, solutionLinks, sourceOf } from "@/content/problems"
import type { Item, Problem } from "@/content/schema"
import { cn } from "@/lib/utils"
import { isSolved } from "@/progress/logic"
import { progressActions, useProgressStore } from "@/progress/store"
import { uiActions, useUiStore } from "@/state/ui"

function groupBySource(problems: Problem[]) {
  const groups = new Map<string, Problem[]>()
  for (const problem of problems) {
    const source = sourceOf(problem.url)
    groups.set(source, [...(groups.get(source) ?? []), problem])
  }
  return [...groups]
}

export function ProblemsTab({ item }: { item: Item }) {
  const { t } = useTranslation()
  const progress = useProgressStore((s) => s.progress)
  const groups = groupBySource(item.problems ?? [])
  const lists = (item.resources ?? []).filter((r) => r.type === "practice")

  if (!groups.length && !lists.length) return <EmptyNote>{t("problems.empty")}</EmptyNote>

  return (
    <>
      {groups.length > 0 && (
        <Section title={t("block.problems")}>
          <div className="space-y-4">
            {groups.map(([source, problems]) => (
              <div key={source}>
                <h4 className="mb-0.5 font-mono text-13 font-semibold">
                  {source}{" "}
                  <span className="ml-1 text-12 font-normal text-syn-number">
                    {problems.filter((p) => isSolved(progress, p.url)).length}/{problems.length}
                  </span>
                </h4>
                <ul>
                  {problems.map((problem, i) => (
                    <ProblemRow key={`${problem.url}#${i}`} problem={problem} item={item} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      )}
      {lists.length > 0 && (
        <Section title={t("block.moreLists")}>
          <ResourceList resources={lists} />
        </Section>
      )}
    </>
  )
}

function ProblemRow({ problem, item }: { problem: Problem; item: Item }) {
  const { t } = useTranslation()
  const localize = useLocalize()
  const solved = useProgressStore((s) => isSolved(s.progress, problem.url))
  const [helpOpen, setHelpOpen] = useState(false)
  const helpId = useId()
  const title = localize(problem.title)

  return (
    <li className={LINK_ROW}>
      <Checkbox
        checked={solved}
        onCheckedChange={(checked) => progressActions.setSolved(problem.url, checked === true)}
        aria-label={t("problem.solvedLabel", { title })}
      />
      <a
        className={cn("min-w-0 flex-1", solved && "text-faint line-through")}
        href={problem.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {title}
      </a>
      {problem.level && (
        <Tag shape="pill" tone={levelTone(problem.level)}>
          {problem.level}
        </Tag>
      )}
      <Button
        variant="outline"
        size="xs"
        aria-expanded={helpOpen}
        aria-controls={helpId}
        onClick={() => setHelpOpen((open) => !open)}
        className="text-muted-foreground aria-expanded:border-link aria-expanded:text-link"
      >
        {t("help.toggle")}
      </Button>
      {problem.note && (
        <span className="basis-full pl-6.5 text-12 text-faint">
          <InlineText text={localize(problem.note)} />
        </span>
      )}
      {helpOpen && <ProblemHelp id={helpId} problem={problem} title={title} item={item} />}
    </li>
  )
}

/** "How to solve" under a problem: solution links, and an AI chat with a ready-made prompt */
function ProblemHelp({
  id,
  problem,
  title,
  item,
}: {
  id: string
  problem: Problem
  title: string
  item: Item
}) {
  const { t } = useTranslation()
  const localize = useLocalize()
  const aiMode = useUiStore((s) => s.aiMode)
  const codeLang = useUiStore((s) => s.codeLang)
  const links = solutionLinks(problem, title, t, (guide) => localize(guide.title))
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null)

  // Copy first, then open the tab: once the new tab has focus the browser refuses the copy
  async function ask(tool: (typeof AI_TOOLS)[number] | null) {
    const prompt = t(`prompt.${aiMode}`, {
      title,
      url: problem.url,
      site: [sourceOf(problem.url), problem.level && `(${problem.level})`]
        .filter(Boolean)
        .join(" "),
      lesson: plainText(localize(item.title)),
      lang: codeLangLabel(codeLang),
    })
    let copied = true
    try {
      await navigator.clipboard.writeText(prompt)
    } catch {
      copied = false
    }
    if (tool) window.open(tool.url + encodeURIComponent(prompt), "_blank", "noopener,noreferrer")

    const text = tool
      ? `${t("help.opened", { name: tool.name })} ${copied ? t("help.pasteHint") : t("help.copyFailed")}`
      : copied
        ? t("help.copied")
        : t("help.copyFailed")
    setStatus({ text, ok: copied })
  }

  return (
    <div
      id={id}
      className="my-1 ml-6.5 grid basis-full grid-cols-[max-content_1fr] items-center gap-x-3.5 gap-y-2 rounded-md border bg-background px-3 py-2.5 text-13 max-sm:ml-0 max-sm:grid-cols-1 max-sm:gap-1.5"
    >
      <p className="col-span-full mb-2 text-12 text-muted-foreground">{t("help.tip")}</p>
      <span className={LABEL}>{t("help.read")}</span>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5">
        {links.map((link) => (
          <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">
            {link.label}
          </a>
        ))}
      </div>
      <span className={LABEL}>{t("help.ask")}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        <Segmented
          className="mr-1"
          label={t("help.modeLabel")}
          value={aiMode}
          onChange={uiActions.setAiMode}
          options={AI_MODES.map((mode) => ({ value: mode, label: t(`help.mode.${mode}`) }))}
        />
        {AI_TOOLS.map((tool) => (
          <Button key={tool.id} variant="outline" size="xs" onClick={() => void ask(tool)}>
            {t("help.open", { name: tool.name })}
          </Button>
        ))}
        <Button variant="outline" size="xs" onClick={() => void ask(null)}>
          {t("help.copy")}
        </Button>
      </div>
      {/* In the panel, not a toast: while the dialog is open, everything outside it
          (the toaster included) is hidden from screen readers */}
      <p
        aria-live="polite"
        className={cn("col-span-full text-12 empty:hidden", status?.ok ? "text-ok" : "text-warn")}
      >
        {status?.text}
      </p>
    </div>
  )
}
