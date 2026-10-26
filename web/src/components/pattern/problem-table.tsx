import { useMemo } from "react"
import {
  columnFacetingFeature,
  columnFilteringFeature,
  createColumnHelper,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createSortedRowModel,
  functionalUpdate,
  metaHelper,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type Column,
  type ColumnFiltersState,
  type FilterFn,
  type SortFn,
  type SortingState,
  type Updater,
} from "@tanstack/react-table"
import type { ParseKeys } from "i18next"
import { useTranslation } from "react-i18next"
import { LevelBadgeForProblemLevel, OutcomeTag } from "@/components/common/badges"
import { useNow } from "@/lib/clock"
import { dueText, formatDate, formatShortDate } from "@/lib/time"
import { cn } from "@/lib/utils"
import { useLang, useNotebook } from "@/notebook/hooks"
import { attemptsOf, isDue, problemSchedule, problemsOf } from "@/notebook/logic"
import type { Attempt, Outcome, Problem } from "@/notebook/schema"
import { href } from "@/state/router"
import { uiActions, useUiStore } from "@/state/ui"

// A pattern's problem table: its columns, how each one sorts, and the level and status
// filters. The problem page's previous / next arrows read the same table, so "next" is
// always the row below.

export interface ProblemRow {
  problem: Problem
  attempts: Attempt[]
  last: Attempt | null
  dueAt: string | null
}

interface ColumnMeta {
  label: ParseKeys
  /** Numbers line up on the right, header included */
  align?: "end"
  /** Classes for the column's cells */
  className?: string
}

const features = tableFeatures({
  columnFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  // Facets: how many rows each filter choice would keep, given the other column's filter
  columnFacetingFeature,
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  columnMeta: metaHelper<ColumnMeta>(),
})

export type ProblemColumn = Column<typeof features, ProblemRow, unknown>
export type ProblemTable = ReturnType<typeof useProblemTable>

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })
const byText: SortFn<typeof features, ProblemRow> = (a, b, id) =>
  collator.compare(a.getValue<string>(id), b.getValue<string>(id))
const byNumber: SortFn<typeof features, ProblemRow> = (a, b, id) =>
  a.getValue<number>(id) - b.getValue<number>(id)

const LEVEL_RANK: Record<string, number> = { easy: 0, medium: 1, hard: 2 }
/** Ascending: not done first, then from the weakest latest attempt to the strongest */
const STATUS_RANK: Record<Outcome | "todo", number> = { todo: 0, solution: 1, hint: 2, alone: 3 }

const levelRank = (level: string) => (level ? (LEVEL_RANK[level.toLowerCase()] ?? 3) : undefined)
const time = (iso: string | null | undefined) => (iso ? Date.parse(iso) : undefined)

/** Filter keys. Levels from the old roadmap are capitalised ("Medium"); no level is "none" */
export const levelKey = (level: string) => (level ? level.toLowerCase() : "none")
export const LEVEL_KEYS = ["easy", "medium", "hard"]
export const STATUS_KEYS = ["todo", "alone", "hint", "solution"] as const

/**
 * Keeps a row whose key is one of the chosen ones. The key is the column's getUniqueValues,
 * which the facet counts read too: the filter and its counts cannot disagree.
 */
const inKeys: FilterFn<typeof features, ProblemRow> = Object.assign(
  (row: { getUniqueValues: <T>(id: string) => T[] }, id: string, keys: unknown) =>
    Array.isArray(keys) && keys.includes(row.getUniqueValues<string>(id)[0]),
  { autoRemove: (keys: unknown) => !Array.isArray(keys) || keys.length === 0 }
)

function TitleCell({ problem }: { problem: Problem }) {
  const { t } = useTranslation()
  return (
    <>
      <a href={href.problem(problem.id)} className="font-medium">
        {problem.title}
      </a>
      {problem.patternIds.length > 1 && (
        <span className="ml-1.5 font-mono text-11 text-faint">
          {t("problem.inPatterns", { count: problem.patternIds.length })}
        </span>
      )}
    </>
  )
}

function StatusCell({ last }: { last: Attempt | null }) {
  const { t } = useTranslation()
  return (
    <>
      <OutcomeTag outcome={last?.outcome ?? "todo"} />
      {last?.imported && <span className="ml-1 text-11 text-faint">{t("attempt.imported")}</span>}
    </>
  )
}

/** Day and month only when it is this year: keeps the column narrow */
function LastCell({ last }: { last: Attempt | null }) {
  const lang = useLang()
  const now = useNow()
  if (!last) return "—"
  const thisYear = new Date(last.at).getFullYear() === new Date(now).getFullYear()
  const full = formatDate(last.at, lang)
  return <span title={full}>{thisYear ? formatShortDate(last.at, lang) : full}</span>
}

function RedoCell({ row }: { row: ProblemRow }) {
  const { t } = useTranslation()
  const now = useNow()
  if (!row.last) return "—"
  return (
    <span className={cn(isDue(row.dueAt, now) && "font-semibold text-warn")}>
      {dueText(row.dueAt, t, now)}
    </span>
  )
}

const MONO = "font-mono text-12 whitespace-nowrap text-muted-foreground"
const helper = createColumnHelper<typeof features, ProblemRow>()

// Empty values (no level, never tried) go last in both directions; ties keep the order added
export const problemColumns = helper.columns([
  helper.accessor((r) => r.problem.title, {
    id: "title",
    sortFn: byText,
    enableColumnFilter: false,
    meta: { label: "problem.colProblem" },
    cell: ({ row }) => <TitleCell problem={row.original.problem} />,
  }),
  helper.accessor((r) => levelRank(r.problem.level), {
    id: "level",
    sortFn: byNumber,
    sortUndefined: "last",
    getUniqueValues: (r) => [levelKey(r.problem.level)],
    filterFn: inKeys,
    meta: { label: "problem.colLevel" },
    cell: ({ row }) => <LevelBadgeForProblemLevel level={row.original.problem.level} />,
  }),
  helper.accessor((r) => STATUS_RANK[r.last?.outcome ?? "todo"], {
    id: "status",
    sortFn: byNumber,
    getUniqueValues: (r) => [r.last?.outcome ?? "todo"],
    filterFn: inKeys,
    meta: { label: "problem.colStatus", className: "whitespace-nowrap" },
    cell: ({ row }) => <StatusCell last={row.original.last} />,
  }),
  helper.accessor((r) => r.attempts.length, {
    id: "attempts",
    sortFn: byNumber,
    enableColumnFilter: false,
    meta: { label: "problem.colAttempts", align: "end", className: MONO },
    cell: ({ getValue }) => getValue(),
  }),
  helper.accessor((r) => time(r.last?.at), {
    id: "last",
    sortFn: byNumber,
    enableColumnFilter: false,
    sortUndefined: "last",
    meta: { label: "problem.colLast", className: MONO },
    cell: ({ row }) => <LastCell last={row.original.last} />,
  }),
  helper.accessor((r) => time(r.dueAt), {
    id: "redo",
    sortFn: byNumber,
    enableColumnFilter: false,
    sortUndefined: "last",
    meta: { label: "problem.colRedo", className: MONO },
    cell: ({ row }) => <RedoCell row={row.original} />,
  }),
])

const COLUMN_IDS = new Set(problemColumns.map((c) => c.id))
const rowId = (row: ProblemRow) => row.problem.id

function setSorting(updater: Updater<SortingState>) {
  uiActions.setProblemSort(functionalUpdate(updater, useUiStore.getState().problemSort))
}

function setFilters(updater: Updater<ColumnFiltersState>) {
  uiActions.setProblemFilters(functionalUpdate(updater, useUiStore.getState().problemFilters))
}

const NO_FILTERS: ColumnFiltersState = []

/**
 * The problem table of a pattern, sorted as the user last chose (one sort for every pattern,
 * remembered on this device). A header click sorts ascending, then descending, then goes back
 * to the order the problems were added in. The filters are shared by every pattern too, but
 * last only until the app is closed. `filtered: false` gives every row, still sorted.
 */
export function useProblemTable(patternId: string, { filtered = true } = {}) {
  const nb = useNotebook()
  const savedSort = useUiStore((s) => s.problemSort)
  const savedFilters = useUiStore((s) => s.problemFilters)
  const sorting = useMemo(() => savedSort.filter((s) => COLUMN_IDS.has(s.id)), [savedSort])
  const columnFilters = useMemo(
    () => (filtered ? savedFilters.filter((f) => COLUMN_IDS.has(f.id)) : NO_FILTERS),
    [filtered, savedFilters]
  )
  const data = useMemo(
    () =>
      problemsOf(nb, patternId).map((problem): ProblemRow => {
        const attempts = attemptsOf(nb, problem.id)
        return { problem, attempts, ...problemSchedule(attempts) }
      }),
    [nb, patternId]
  )
  return useTable({
    features,
    columns: problemColumns,
    data,
    getRowId: rowId,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setFilters,
    sortDescFirst: false,
    enableMultiSort: false,
  })
}
