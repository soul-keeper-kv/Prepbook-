import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { LABEL } from "@/components/section"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { useRoadmapStats } from "@/progress/selectors"

function StatCard({
  label,
  value,
  valueClass,
  children,
}: {
  label: string
  value: string
  valueClass: string
  children?: ReactNode
}) {
  return (
    <div className="rounded-md border bg-card px-3.5 py-3">
      <div className={LABEL}>{label}</div>
      <div className={cn("mt-1 font-mono text-24 leading-tight font-semibold", valueClass)}>
        {value}
      </div>
      {children}
    </div>
  )
}

export function Stats() {
  const { t } = useTranslation()
  const stats = useRoadmapStats()

  return (
    <section className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
      <StatCard label={t("stats.progress")} value={`${stats.pct}%`} valueClass="text-syn-number">
        <Progress value={stats.pct} className="mt-2" aria-label={t("stats.progress")} />
        <div className="mt-1.5 font-mono text-12 text-muted-foreground">
          {t("stats.items", { done: stats.done, total: stats.total })}
        </div>
      </StatCard>
      <StatCard
        label={t("stats.current")}
        value={stats.currentPhase === -1 ? t("stats.allDone") : String(stats.currentPhase)}
        valueClass="text-syn-type"
      />
      <StatCard
        label={t("stats.solved")}
        value={`${stats.solved}/${stats.problems}`}
        valueClass="text-syn-function"
      />
      <StatCard
        label={t("stats.review")}
        value={String(stats.dueForReview)}
        valueClass="text-warn"
      />
    </section>
  )
}
