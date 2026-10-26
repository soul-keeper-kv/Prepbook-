import { ChevronLeftIcon, ChevronRightIcon, FunnelIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useProblemTable } from "@/components/pattern/problem-table"
import { Button } from "@/components/ui/button"
import type { Pattern, Problem } from "@/notebook/schema"
import { href, replace } from "@/state/router"

/**
 * Previous and next problem, in the order of the pattern's problem table, sort and filters
 * included. Stepping swaps the history entry, so Back still returns to the page the problems
 * were opened from.
 */
export function ProblemPager({ problem, pattern }: { problem: Problem; pattern: Pattern }) {
  const { t } = useTranslation()
  const table = useProblemTable(pattern.id)
  const sorted = useProblemTable(pattern.id, { filtered: false }).getRowModel().rows
  const shown = new Set(table.getRowModel().rows.map((row) => row.id))
  const filtered = table.state.columnFilters.length > 0
  // This problem stays in the list even when it no longer matches (its status just changed
  // with a new attempt): the arrows then go on to its neighbours that still match
  const problems = sorted
    .filter((row) => shown.has(row.id) || row.id === problem.id)
    .map((row) => row.original.problem)
  const index = problems.findIndex((p) => p.id === problem.id)
  if (index < 0 || problems.length < 2) return null
  const prev = problems[index - 1]
  const next = problems[index + 1]
  const prevLabel = prev ? t("problem.prevNamed", { name: prev.title }) : t("problem.prev")
  const nextLabel = next ? t("problem.nextNamed", { name: next.title }) : t("problem.next")

  return (
    <nav
      aria-label={t("problem.pager", { name: pattern.name })}
      className="flex items-center gap-1"
    >
      <Button
        size="icon-xs"
        variant="outline"
        className="max-md:size-11"
        disabled={!prev}
        aria-label={prevLabel}
        title={prevLabel}
        onClick={() => prev && replace(href.problem(prev.id))}
      >
        <ChevronLeftIcon />
      </Button>
      <span className="inline-flex min-w-12 items-center justify-center gap-1 font-mono text-12 text-muted-foreground">
        {filtered && (
          <span title={t("problem.pagerFiltered")} className="inline-flex">
            <FunnelIcon className="size-3 text-link" aria-hidden />
            <span className="sr-only">{t("problem.pagerFiltered")}</span>
          </span>
        )}
        <span aria-hidden>
          {index + 1} / {problems.length}
        </span>
        <span className="sr-only">
          {t("problem.position", { index: index + 1, count: problems.length })}
        </span>
      </span>
      <Button
        size="icon-xs"
        variant="outline"
        className="max-md:size-11"
        disabled={!next}
        aria-label={nextLabel}
        title={nextLabel}
        onClick={() => next && replace(href.problem(next.id))}
      >
        <ChevronRightIcon />
      </Button>
    </nav>
  )
}
