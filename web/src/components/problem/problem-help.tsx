import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Segmented } from "@/components/segmented"
import { LABEL } from "@/components/section"
import { Button } from "@/components/ui/button"
import { codeLangLabel } from "@/content/code-langs"
import { useContent } from "@/content/context"
import { useLocalize } from "@/content/localize"
import { AI_MODES, AI_TOOLS, solutionLinks, sourceOf } from "@/content/problems"
import { cn } from "@/lib/utils"
import type { Problem } from "@/notebook/schema"
import { findSuggestedProblem } from "@/notebook/suggestions"
import { uiActions, useUiStore } from "@/state/ui"

/**
 * "Stuck?": links to solutions and an AI chat with a ready-made prompt. Using it means the
 * attempt was not solved alone: the panel says so, so the outcome is logged honestly.
 */
export function ProblemHelp({ problem, patternNames }: { problem: Problem; patternNames: string }) {
  const { t } = useTranslation()
  const aiMode = useUiStore((s) => s.aiMode)
  const codeLang = useUiStore((s) => s.codeLang)
  const content = useContent()
  const localize = useLocalize()
  // data/ may list guides written for this very problem: they come first
  const guides = findSuggestedProblem(content, problem.url)?.problem.guides
  const links = solutionLinks(
    { url: problem.url, title: problem.title, level: problem.level, guides },
    problem.title,
    t,
    (guide) => localize(guide.title)
  )
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null)

  // Copy first, then open the tab: once the new tab has focus the browser refuses the copy
  async function ask(tool: (typeof AI_TOOLS)[number] | null) {
    const prompt = t(`prompt.${aiMode}`, {
      title: problem.title,
      url: problem.url,
      site: [sourceOf(problem.url), problem.level && `(${problem.level})`]
        .filter(Boolean)
        .join(" "),
      lesson: patternNames,
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
    <div className="grid grid-cols-[max-content_1fr] items-center gap-x-3.5 gap-y-2 text-13 max-sm:grid-cols-1 max-sm:gap-1.5">
      <p className="col-span-full mb-1 text-12 text-muted-foreground">{t("help.tip")}</p>
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
      <p
        aria-live="polite"
        className={cn("col-span-full text-12 empty:hidden", status?.ok ? "text-ok" : "text-warn")}
      >
        {status?.text}
      </p>
    </div>
  )
}
