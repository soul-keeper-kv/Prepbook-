import { useState } from "react"
import { useTranslation } from "react-i18next"
import { AskStatusLine, useAskAi } from "@/components/common/ask-ai"
import { Segmented } from "@/components/segmented"
import { LABEL } from "@/components/section"
import { Button } from "@/components/ui/button"
import { codeLangLabel } from "@/content/code-langs"
import { useContent } from "@/content/context"
import { useLocalize } from "@/content/localize"
import {
  AI_MODES,
  AI_TOOLS,
  THINK_MINUTES,
  solutionLinks,
  sourceOf,
  type AiMode,
} from "@/content/problems"
import type { Problem } from "@/notebook/schema"
import { findSuggestedProblem } from "@/notebook/suggestions"
import { uiActions, useUiStore } from "@/state/ui"

/**
 * "Stuck?": links to solutions and an AI chat with a ready-made prompt. Using it means the
 * attempt was not solved alone: the panel says so, so the outcome is logged honestly.
 */
export function ProblemHelp({
  problem,
  patternNames,
  initialMode,
}: {
  problem: Problem
  patternNames: string
  /** Start on this mode without changing the saved choice (a lesson's guided example) */
  initialMode?: AiMode
}) {
  const { t } = useTranslation()
  const savedMode = useUiStore((s) => s.aiMode)
  const [modeOverride, setModeOverride] = useState(initialMode)
  const aiMode = modeOverride ?? savedMode
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
  const { ask: askAi, status } = useAskAi()
  const prompt = () =>
    t(`prompt.${aiMode}`, {
      title: problem.title,
      url: problem.url,
      site: [sourceOf(problem.url), problem.level && `(${problem.level})`]
        .filter(Boolean)
        .join(" "),
      lesson: patternNames,
      lang: codeLangLabel(codeLang),
    })
  const ask = (tool: (typeof AI_TOOLS)[number] | null) => void askAi(prompt(), tool)

  return (
    // Labels beside their links only when the panel itself is wide: in the problem page's
    // side column it is narrow even on a desktop, and the AI buttons would overflow
    <div className="@container">
      <div className="grid grid-cols-1 items-center gap-1.5 text-13 @md:grid-cols-[max-content_minmax(0,1fr)] @md:gap-x-3.5 @md:gap-y-2">
        <p className="col-span-full mb-1 text-12 text-muted-foreground">
          {t("help.tip", { minutes: THINK_MINUTES })}
        </p>
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
            onChange={(mode) => {
              setModeOverride(undefined)
              uiActions.setAiMode(mode)
            }}
            options={AI_MODES.map((mode) => ({ value: mode, label: t(`help.mode.${mode}`) }))}
          />
          {AI_TOOLS.map((tool) => (
            <Button key={tool.id} variant="outline" size="xs" onClick={() => ask(tool)}>
              {t("help.open", { name: tool.name })}
            </Button>
          ))}
          <Button variant="outline" size="xs" onClick={() => ask(null)}>
            {t("help.copy")}
          </Button>
        </div>
        <AskStatusLine status={status} className="col-span-full" />
      </div>
    </div>
  )
}
