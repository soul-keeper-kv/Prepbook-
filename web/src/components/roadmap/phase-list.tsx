import { ChevronRightIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useShallow } from "zustand/react/shallow"
import { ItemRow } from "@/components/roadmap/item-row"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Progress } from "@/components/ui/progress"
import { useContent } from "@/content/context"
import { useLocalize } from "@/content/localize"
import type { Phase } from "@/content/schema"
import { cn } from "@/lib/utils"
import { isDone, needsReview } from "@/progress/logic"
import { usePhaseStats } from "@/progress/selectors"
import { useProgressStore } from "@/progress/store"
import { uiActions, useUiStore, type Filter } from "@/state/ui"
import type { Progress as ProgressData } from "@/progress/schema"

const FILTER_TEST: Record<Filter, (progress: ProgressData, id: string) => boolean> = {
  all: () => true,
  todo: (progress, id) => !isDone(progress, id),
  review: (progress, id) => needsReview(progress, id),
}

export function PhaseList() {
  const { phases } = useContent()
  return (
    <div>
      {phases.map((phase, index) => (
        <PhaseCard key={phase.id} phase={phase} index={index} />
      ))}
    </div>
  )
}

// Each phase is a folder of VS Code's Explorer tree: chevron, number, and the items indented
// under it with a vertical guide line.
function PhaseCard({ phase, index }: { phase: Phase; index: number }) {
  const { t } = useTranslation()
  const localize = useLocalize()
  const open = useUiStore((s) => s.expanded.includes(phase.id))
  const filter = useUiStore((s) => s.filter)
  const stats = usePhaseStats(phase)
  // Shallow-compared list of ids: unchanged unless an item enters or leaves the filter
  const visibleIds = useProgressStore(
    useShallow((s) =>
      phase.items.filter((item) => FILTER_TEST[filter](s.progress, item.id)).map((i) => i.id)
    )
  )
  const visible = phase.items.filter((item) => visibleIds.includes(item.id))
  const meta = [localize(phase.time), t("stats.items", { done: stats.done, total: stats.total })]
    .filter(Boolean)
    .join(" · ")

  return (
    <Collapsible
      open={open}
      onOpenChange={() => uiActions.togglePhase(phase.id)}
      className="mb-2 overflow-hidden rounded-md border bg-card"
    >
      <CollapsibleTrigger className="group/head flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left outline-none select-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-data-[state=open]/head:rotate-90" />
        <span className="font-mono text-12 text-faint" aria-hidden>
          {String(index).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-15 font-semibold">{localize(phase.name)}</div>
          <div className="mt-0.5 mb-1.5 font-mono text-12 text-muted-foreground">{meta}</div>
          <Progress value={stats.pct} aria-hidden />
        </div>
        <span
          className={cn(
            "min-w-11 text-right font-mono text-13",
            stats.pct === 100 ? "text-ok" : "text-muted-foreground"
          )}
        >
          {stats.pct}%
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {visible.length ? (
          visible.map((item) => <ItemRow key={item.id} item={item} />)
        ) : (
          <div className="border-t py-2.5 pr-3 pl-9.5 font-mono text-12 text-faint">
            {t(`filter.empty.${filter}`)}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
