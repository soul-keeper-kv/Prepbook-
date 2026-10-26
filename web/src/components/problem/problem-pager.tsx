import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { useNotebook } from "@/notebook/hooks"
import { problemsOf } from "@/notebook/logic"
import type { Pattern, Problem } from "@/notebook/schema"
import { href, replace } from "@/state/router"

/**
 * Previous and next problem, in the order of the pattern's problem table. Stepping swaps the
 * history entry, so Back still returns to the page the problems were opened from.
 */
export function ProblemPager({ problem, pattern }: { problem: Problem; pattern: Pattern }) {
  const { t } = useTranslation()
  const problems = problemsOf(useNotebook(), pattern.id)
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
      <span className="min-w-12 text-center font-mono text-12 text-muted-foreground">
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
