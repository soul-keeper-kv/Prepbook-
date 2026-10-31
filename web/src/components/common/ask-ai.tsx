import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { AI_TOOLS } from "@/content/problems"
import { cn } from "@/lib/utils"

type AiTool = (typeof AI_TOOLS)[number]
export interface AskStatus {
  text: string
  ok: boolean
}

/** Sends a prompt to an AI chat: copied first, then the chat opens in a new tab */
export function useAskAi() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<AskStatus | null>(null)

  // Copy first, then open the tab: once the new tab has focus the browser refuses the copy
  async function ask(prompt: string, tool: AiTool | null) {
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

  return { ask, status }
}

/** What happened to the last prompt, read out to screen readers */
export function AskStatusLine({
  status,
  className,
}: {
  status: AskStatus | null
  className?: string
}) {
  return (
    <p
      aria-live="polite"
      className={cn("text-12 empty:hidden", status?.ok ? "text-ok" : "text-warn", className)}
    >
      {status?.text}
    </p>
  )
}

/** "Open Claude", "Open ChatGPT", "Copy the prompt", for one ready-made prompt */
export function AskAiButtons({ prompt }: { prompt: string }) {
  const { t } = useTranslation()
  const { ask, status } = useAskAi()
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {AI_TOOLS.map((tool) => (
          <Button
            key={tool.id}
            variant="outline"
            size="xs"
            className="max-md:h-11"
            onClick={() => void ask(prompt, tool)}
          >
            {t("help.open", { name: tool.name })}
          </Button>
        ))}
        <Button
          variant="outline"
          size="xs"
          className="max-md:h-11"
          onClick={() => void ask(prompt, null)}
        >
          {t("help.copy")}
        </Button>
      </div>
      <AskStatusLine status={status} />
    </div>
  )
}
