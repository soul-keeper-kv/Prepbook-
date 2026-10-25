import { useMemo } from "react"
import { useContent } from "@/content/context"
import type { Phase } from "@/content/schema"
import { isDone, isSolved, needsReview } from "@/progress/logic"
import { useProgressStore } from "@/progress/store"

export interface PhaseStats {
  done: number
  total: number
  pct: number
}

const percent = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0)

export function usePhaseStats(phase: Phase): PhaseStats {
  // Selects a number, so notes typed elsewhere do not re-render the phase
  const done = useProgressStore(
    (s) => phase.items.filter((item) => isDone(s.progress, item.id)).length
  )
  return { done, total: phase.items.length, pct: percent(done, phase.items.length) }
}

export function useRoadmapStats() {
  const { phases } = useContent()
  const progress = useProgressStore((s) => s.progress)
  return useMemo(() => {
    const items = phases.flatMap((p) => p.items)
    const done = items.filter((item) => isDone(progress, item.id)).length
    const urls = new Set(items.flatMap((item) => (item.problems ?? []).map((p) => p.url)))
    return {
      done,
      total: items.length,
      pct: percent(done, items.length),
      /** Index of the first phase not finished; -1 when all are done */
      currentPhase: phases.findIndex((p) => !p.items.every((item) => isDone(progress, item.id))),
      solved: [...urls].filter((url) => isSolved(progress, url)).length,
      problems: urls.size,
      dueForReview: items.filter((item) => needsReview(progress, item.id)).length,
    }
  }, [phases, progress])
}
