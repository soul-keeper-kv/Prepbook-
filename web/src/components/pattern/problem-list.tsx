import { useId, useState } from "react"
import { PlusIcon, XIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { LevelBadgeForProblemLevel, OutcomeTag } from "@/components/common/badges"
import { INPUT, SELECT } from "@/components/common/editing"
import { Button } from "@/components/ui/button"
import { useContent } from "@/content/context"
import { dueText } from "@/lib/time"
import { cn } from "@/lib/utils"
import { isHttpUrl, toHref } from "@/notebook/ids"
import { useLang, useNotebook } from "@/notebook/hooks"
import { attemptsOf, isDue, problemSchedule, problemsOf } from "@/notebook/logic"
import type { Pattern, Problem } from "@/notebook/schema"
import { notebookActions } from "@/notebook/store"
import { lookupUrl } from "@/notebook/suggestions"
import { PROBLEM_LEVELS } from "@/pages/inbox-page"
import { href, navigate } from "@/state/router"

function ProblemRow({
  problem,
  pattern,
  now,
}: {
  problem: Problem
  pattern: Pattern
  now: number
}) {
  const { t } = useTranslation()
  const [confirm, setConfirm] = useState(false)
  const attempts = attemptsOf(useNotebook(), problem.id)
  const { dueAt, last } = problemSchedule(attempts)
  const due = isDue(dueAt, now)
  return (
    <tr className={cn("border-t", due && "bg-warn-bg/60")}>
      <td className="px-3 py-2">
        <a href={href.problem(problem.id)} className="font-medium">
          {problem.title}
        </a>
        {problem.patternIds.length > 1 && (
          <span className="ml-1.5 font-mono text-11 text-faint">
            {t("problem.inPatterns", { count: problem.patternIds.length })}
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <LevelBadgeForProblemLevel level={problem.level} />
      </td>
      <td className="px-3 py-2">
        <OutcomeTag outcome={last?.outcome ?? "todo"} />
        {last?.imported && <span className="ml-1 text-11 text-faint">{t("attempt.imported")}</span>}
      </td>
      <td
        className={cn(
          "px-3 py-2 font-mono text-12 whitespace-nowrap",
          due ? "font-semibold text-warn" : "text-muted-foreground"
        )}
      >
        {last ? dueText(dueAt, t, now) : "—"}
      </td>
      <td className="px-1 py-2 text-right">
        <Button
          size="icon-xs"
          variant="ghost"
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
      </td>
    </tr>
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

export function ProblemList({ pattern, now }: { pattern: Pattern; now: number }) {
  const { t } = useTranslation()
  const problems = problemsOf(useNotebook(), pattern.id)
  return (
    <>
      {/* relative: the sr-only header cell is absolutely placed and must stay in the scroll box */}
      {problems.length > 0 ? (
        <div className="relative overflow-x-auto rounded-md border">
          <table className="w-full min-w-140 text-left text-14">
            <thead className="bg-background text-12 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{t("problem.colProblem")}</th>
                <th className="px-3 py-2 font-medium">{t("problem.colLevel")}</th>
                <th className="px-3 py-2 font-medium">{t("problem.colLast")}</th>
                <th className="px-3 py-2 font-medium">{t("problem.colRedo")}</th>
                <th className="px-1 py-2">
                  <span className="sr-only">{t("problem.colActions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {problems.map((problem) => (
                <ProblemRow key={problem.id} problem={problem} pattern={pattern} now={now} />
              ))}
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
