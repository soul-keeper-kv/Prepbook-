import { ChevronRightIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { THINK_MINUTES } from "@/content/problems"
import { uiActions, useUiStore } from "@/state/ui"

/** The steps of solving any problem, whatever its pattern */
const SOLVE_STEPS = ["understand", "limits", "brute", "waste", "trace", "edges", "stuck"] as const

/** Largest n each complexity runs in about a second, at ~10⁸ simple operations a second */
const LIMITS = [
  ["10", "n!"],
  ["20", "2ⁿ"],
  ["500", "n³"],
  ["5000", "n²"],
  ["10⁶", "n log n"],
] as const

/**
 * "How to solve a problem", above the attempt form: a beginner's checklist to think through,
 * not a form. Nothing is saved but whether it starts open on this device.
 */
export function SolveSteps() {
  const { t } = useTranslation()
  const open = useUiStore((s) => s.solveStepsOpen)
  const detail: Record<(typeof SOLVE_STEPS)[number], string> = {
    understand: t("solve.step.understand.detail"),
    limits: t("solve.step.limits.detail"),
    brute: t("solve.step.brute.detail"),
    waste: t("solve.step.waste.detail"),
    trace: t("solve.step.trace.detail"),
    edges: t("solve.step.edges.detail"),
    stuck: t("solve.step.stuck.detail", { help: t("help.toggle"), mode: t("help.mode.hint") }),
  }
  const limits = [
    ...LIMITS.map(([n, big]) => `n ≤ ${n} → O(${big})`),
    `${t("solve.larger")} → O(n), O(log n)`,
  ]

  return (
    <Collapsible
      open={open}
      onOpenChange={uiActions.setSolveStepsOpen}
      className="rounded-md border bg-card"
    >
      <CollapsibleTrigger className="group/h flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left text-14 font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:min-h-11">
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/h:rotate-90" />
        {t("solve.title")}
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-4 py-3">
        <ol className="space-y-2">
          {SOLVE_STEPS.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="mt-0.5 w-4 shrink-0 text-right font-mono text-12 text-muted-foreground">
                {i + 1}.
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-14 font-medium">
                  {step === "stuck"
                    ? t("solve.step.stuck.title", { minutes: THINK_MINUTES })
                    : t(`solve.step.${step}.title` as "solve.step.understand.title")}
                </p>
                <p className="text-13 text-muted-foreground">{detail[step]}</p>
                {step === "limits" && (
                  <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-12 text-muted-foreground">
                    {limits.map((line) => (
                      <li key={line} className="whitespace-nowrap">
                        {line}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-3 border-t pt-2 text-12 text-muted-foreground">
          {t("solve.logHint", { note: t("attempt.note") })}
        </p>
      </CollapsibleContent>
    </Collapsible>
  )
}
