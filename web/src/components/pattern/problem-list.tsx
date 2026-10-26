import { useId, useState } from "react"
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  FunnelIcon,
  PlusIcon,
  XIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { INPUT, SELECT } from "@/components/common/editing"
import {
  LEVEL_KEYS,
  STATUS_KEYS,
  useProblemTable,
  type ProblemColumn,
  type ProblemTable,
} from "@/components/pattern/problem-table"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useContent } from "@/content/context"
import { cn } from "@/lib/utils"
import { isHttpUrl, toHref } from "@/notebook/ids"
import { useLang, useNotebook } from "@/notebook/hooks"
import { isDue } from "@/notebook/logic"
import type { Pattern, Problem } from "@/notebook/schema"
import { notebookActions } from "@/notebook/store"
import { lookupUrl } from "@/notebook/suggestions"
import { PROBLEM_LEVELS } from "@/pages/inbox-page"
import { href, navigate } from "@/state/router"

function UnlinkButton({ problem, pattern }: { problem: Problem; pattern: Pattern }) {
  const { t } = useTranslation()
  const [confirm, setConfirm] = useState(false)
  return (
    <>
      <Button
        size="icon-xs"
        variant="ghost"
        className="max-md:size-11"
        aria-label={t("problem.unlink", { name: problem.title })}
        onClick={() => setConfirm(true)}
      >
        <XIcon />
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("problem.unlinkTitle", { name: problem.title })}
        description={
          problem.patternIds.length > 1 ? t("problem.unlinkText") : t("problem.unlinkLastText")
        }
        action={t("problem.unlinkAction")}
        destructive
        onConfirm={() => notebookActions.unlinkProblem(problem.id, pattern.id)}
      />
    </>
  )
}

export function AddProblemForm({ pattern }: { pattern: Pattern }) {
  const { t } = useTranslation()
  const content = useContent()
  const nb = useNotebook()
  const lang = useLang()
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const [level, setLevel] = useState("")
  const levelId = useId()
  const valid = isHttpUrl(url)
  const known = valid ? lookupUrl(content, nb, toHref(url), lang) : null

  function add() {
    if (!valid) return
    const id = notebookActions.addProblem({
      url: toHref(url),
      title: title.trim() || known?.title || "",
      level: level || known?.level || "",
      patternIds: [pattern.id],
    })
    setUrl("")
    setTitle("")
    setLevel("")
    toast.success(t("problem.added"), {
      action: { label: t("problem.logNow"), onClick: () => navigate(href.problem(id)) },
    })
  }

  return (
    <form
      className="mt-3 flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        add()
      }}
    >
      <input
        aria-label={t("problem.url")}
        className={cn(INPUT, "flex-[2_1_220px]")}
        inputMode="url"
        value={url}
        placeholder={t("problem.urlPlaceholder")}
        onChange={(e) => setUrl(e.target.value)}
      />
      <input
        aria-label={t("problem.title")}
        className={cn(INPUT, "flex-[2_1_180px]")}
        value={title}
        placeholder={known?.title || t("problem.titlePlaceholder")}
        onChange={(e) => setTitle(e.target.value)}
      />
      <label htmlFor={levelId} className="sr-only">
        {t("problem.level")}
      </label>
      <select
        id={levelId}
        className={SELECT}
        value={level || known?.level || ""}
        onChange={(e) => setLevel(e.target.value)}
      >
        <option value="">{t("problem.level")}</option>
        {PROBLEM_LEVELS.map((l) => (
          <option key={l} value={l}>
            {t(`problemLevel.${l}`)}
          </option>
        ))}
      </select>
      <Button type="submit" disabled={!valid}>
        <PlusIcon />
        {t("problem.add")}
      </Button>
    </form>
  )
}

const SORT_ICON = { asc: ArrowUpIcon, desc: ArrowDownIcon }

const selectedKeys = (column: ProblemColumn) => {
  const value = column.getFilterValue()
  return Array.isArray(value) ? (value as string[]) : []
}

/** A funnel in a column title: a menu of the column's values to keep, with their counts */
function HeaderFilter({ column, table }: { column: ProblemColumn; table: ProblemTable }) {
  const { t } = useTranslation()
  const selected = selectedKeys(column)
  // Counts follow the other column's filter; only values this pattern has are offered
  const counts = column.getFacetedUniqueValues()
  const present = new Set([
    ...table.getCoreRowModel().rows.flatMap((row) => row.getUniqueValues<string>(column.id)),
    ...selected,
  ])
  const options =
    column.id === "status"
      ? STATUS_KEYS.filter((k) => present.has(k)).map((key) => ({
          key,
          label: t(`outcome.${key}`),
        }))
      : [
          ...LEVEL_KEYS,
          ...[...present].filter((k) => k !== "none" && !LEVEL_KEYS.includes(k)).sort(),
          "none",
        ]
          .filter((k) => present.has(k))
          .map((key) => ({
            key,
            label:
              key === "none"
                ? t("problem.levelNone")
                : LEVEL_KEYS.includes(key)
                  ? t(`problemLevel.${key}` as "problemLevel.easy")
                  : key.charAt(0).toUpperCase() + key.slice(1),
          }))
  const name = t(column.id === "status" ? "problem.filterStatus" : "problem.filterLevel")
  const label = selected.length ? t("problem.filterOn", { name, count: selected.length }) : name
  const toggle = (key: string, on: boolean) =>
    column.setFilterValue((old: unknown) => {
      const keys = Array.isArray(old) ? (old as string[]) : []
      return on ? [...keys, key] : keys.filter((k) => k !== key)
    })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className={cn(
            "inline-flex size-6 cursor-pointer items-center justify-center rounded-sm outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring max-md:size-11",
            selected.length > 0 && "text-link hover:text-link"
          )}
        >
          <FunnelIcon
            className={cn("size-3", selected.length ? "fill-current" : "text-faint")}
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-auto min-w-48">
        {options.map((option) => {
          const checked = selected.includes(option.key)
          const count = counts.get(option.key) ?? 0
          return (
            <DropdownMenuCheckboxItem
              key={option.key}
              checked={checked}
              // Stay open: several values can be picked in a row
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={(on) => toggle(option.key, on === true)}
              className={cn("gap-4 text-13", !count && !checked && "text-faint")}
            >
              <span className="flex-1">{option.label}</span>
              <span className="font-mono text-11 text-muted-foreground">{count}</span>
            </DropdownMenuCheckboxItem>
          )
        })}
        {selected.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-13" onSelect={() => column.setFilterValue([])}>
              <XIcon />
              {t("problem.filterClearColumn")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** A column title: sorts ascending, descending, then back to the order added; may filter */
function ColumnHeader({ column, table }: { column: ProblemColumn; table: ProblemTable }) {
  const { t } = useTranslation()
  const meta = column.columnDef.meta
  const dir = column.getIsSorted()
  const Icon = dir ? SORT_ICON[dir] : ArrowUpDownIcon
  return (
    <th
      aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined}
      className={cn("px-0.5 py-1 font-medium", meta?.align === "end" && "text-right")}
    >
      <span className="inline-flex items-center">
        <button
          type="button"
          className={cn(
            "inline-flex cursor-pointer items-center gap-1 rounded-sm px-1.5 py-1 whitespace-nowrap outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring max-md:min-h-11",
            dir && "text-foreground"
          )}
          onClick={column.getToggleSortingHandler()}
        >
          {meta && t(meta.label)}
          <Icon className={cn("size-3", !dir && "text-faint")} aria-hidden />
        </button>
        {column.getCanFilter() && <HeaderFilter column={column} table={table} />}
      </span>
    </th>
  )
}

/** Beside the section title: what the filters keep, and the ways back to the full table */
export function ProblemTableActions({ pattern }: { pattern: Pattern }) {
  const { t } = useTranslation()
  const table = useProblemTable(pattern.id)
  const filtered = table.state.columnFilters.length > 0
  const sorted = table.state.sorting.length > 0
  if (!filtered && !sorted) return null
  return (
    <span className="flex flex-wrap items-center gap-1 text-12 text-muted-foreground">
      {filtered && (
        <>
          {t("problem.filterShown", {
            shown: table.getRowModel().rows.length,
            total: table.getCoreRowModel().rows.length,
          })}
          <Button size="xs" variant="ghost" onClick={() => table.setColumnFilters([])}>
            <XIcon />
            {t("problem.filterClear")}
          </Button>
        </>
      )}
      {sorted && (
        <Button size="xs" variant="ghost" onClick={() => table.setSorting([])}>
          <XIcon />
          {t("problem.sortReset")}
        </Button>
      )}
    </span>
  )
}

export function ProblemList({ pattern, now }: { pattern: Pattern; now: number }) {
  const { t } = useTranslation()
  const table = useProblemTable(pattern.id)
  const rows = table.getRowModel().rows
  const headers = table.getHeaderGroups()
  return (
    <>
      {/* relative: the sr-only header cell is absolutely placed and must stay in the scroll box */}
      {table.getCoreRowModel().rows.length > 0 ? (
        <div className="relative overflow-x-auto rounded-md border">
          <table className="w-full min-w-150 table-fixed text-left text-14 max-md:min-w-180">
            <colgroup>
              {table.getAllLeafColumns().map((column) => (
                <col key={column.id} className={column.columnDef.meta?.width} />
              ))}
              <col className="w-9 max-md:w-13" />
            </colgroup>
            <thead className="bg-background text-12 text-muted-foreground">
              {headers.map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => (
                    <ColumnHeader key={header.id} column={header.column} table={table} />
                  ))}
                  <th className="px-1 py-2">
                    <span className="sr-only">{t("problem.colActions")}</span>
                  </th>
                </tr>
              ))}
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn("border-t", isDue(row.original.dueAt, now) && "bg-warn-bg/60")}
                >
                  {row.getAllCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        "px-2 py-2",
                        cell.column.columnDef.meta?.className,
                        cell.column.columnDef.meta?.align === "end" && "text-right"
                      )}
                    >
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                  <td className="px-1 py-1 text-right">
                    <UnlinkButton problem={row.original.problem} pattern={pattern} />
                  </td>
                </tr>
              ))}
              {/* Nothing matches: the header stays, so the filters can still be changed */}
              {rows.length === 0 && (
                <tr className="border-t">
                  <td
                    colSpan={(headers[0]?.headers.length ?? 0) + 1}
                    className="px-3 py-4 text-14 text-faint"
                  >
                    {t("problem.filterEmpty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-14 text-faint">{t("problem.none")}</p>
      )}
      <AddProblemForm pattern={pattern} />
      <p className="mt-1.5 text-12 text-faint">{t("problem.scheduleHint")}</p>
    </>
  )
}
