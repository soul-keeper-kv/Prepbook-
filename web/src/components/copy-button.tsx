import { useEffect, useState } from "react"
import { CheckIcon, CopyIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

type CopyState = "idle" | "done" | "failed"

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const { t } = useTranslation()
  const [state, setState] = useState<CopyState>("idle")

  useEffect(() => {
    if (state === "idle") return
    const timer = setTimeout(() => setState("idle"), 1500)
    return () => clearTimeout(timer)
  }, [state])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setState("done")
    } catch {
      setState("failed")
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-live="polite"
      className={cn(
        "flex shrink-0 cursor-pointer items-center gap-1.5 px-3 font-mono text-12 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        className
      )}
    >
      {state === "done" ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
      {state === "done" ? t("copy.done") : state === "failed" ? t("copy.failed") : t("copy.label")}
    </button>
  )
}
