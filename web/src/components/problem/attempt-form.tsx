import { useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FIELD, INPUT, SELECT, insertTab } from "@/components/common/editing"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { CODE_LANG_LABEL } from "@/content/code-langs"
import { dueText } from "@/lib/time"
import { cn } from "@/lib/utils"
import { attemptsOf, problemSchedule } from "@/notebook/logic"
import { MISTAKES, OUTCOMES, type Outcome } from "@/notebook/schema"
import { notebookActions } from "@/notebook/store"
import { uiActions, useUiStore } from "@/state/ui"

const OUTCOME_STYLE: Record<Outcome, string> = {
  alone: "has-checked:border-ok-fill has-checked:bg-ok-bg",
  hint: "has-checked:border-warn has-checked:bg-warn-bg",
  solution: "has-checked:border-destructive has-checked:bg-danger-bg",
}

interface Draft {
  outcome: Outcome | null
  minutes: string
  mistakes: string[]
  note: string
  code: string
}

const EMPTY: Draft = { outcome: null, minutes: "", mistakes: [], note: "", code: "" }
const draftKey = (problemId: string) => `prep_attempt_draft_${problemId}`

// Half-written attempts survive leaving the page (this tab only)
function readDraft(problemId: string): Draft {
  try {
    const raw = sessionStorage.getItem(draftKey(problemId))
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Draft>) } : EMPTY
  } catch {
    return EMPTY
  }
}

function writeDraft(problemId: string, draft: Draft | null) {
  try {
    if (draft) sessionStorage.setItem(draftKey(problemId), JSON.stringify(draft))
    else sessionStorage.removeItem(draftKey(problemId))
  } catch {
    // Storage blocked: the form still works, it just forgets on leaving
  }
}

/** Log how solving the problem went: the history every review date and level comes from */
export function AttemptForm({ problemId }: { problemId: string }) {
  const { t } = useTranslation()
  const codeLang = useUiStore((s) => s.codeLang)
  const [draft, setDraft] = useState<Draft>(() => readDraft(problemId))
  const minutesId = useId()
  const langId = useId()
  const noteId = useId()
  const codeId = useId()

  useEffect(() => {
    const empty =
      !draft.outcome && !draft.minutes && !draft.mistakes.length && !draft.note && !draft.code
    writeDraft(problemId, empty ? null : draft)
  }, [draft, problemId])

  const update = (changes: Partial<Draft>) => setDraft((d) => ({ ...d, ...changes }))

  function save() {
    if (!draft.outcome) return
    const minutes = Number.parseInt(draft.minutes, 10)
    notebookActions.logAttempt(problemId, {
      outcome: draft.outcome,
      minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : null,
      mistakes: draft.mistakes,
      note: draft.note,
      code: draft.code,
      lang: draft.code.trim() ? codeLang : "",
    })
    const { dueAt } = problemSchedule(attemptsOf(notebookActions.get(), problemId))
    toast.success(t("attempt.saved", { when: dueText(dueAt, t) }))
    setDraft(EMPTY)
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <fieldset>
        <legend className="mb-2 text-14 font-medium">{t("attempt.outcomeQuestion")}</legend>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
          {OUTCOMES.map((o) => (
            <label
              key={o}
              className={cn(
                "flex min-h-11 cursor-pointer flex-col justify-center rounded-md border border-border-strong px-3 py-2 has-focus-visible:ring-2 has-focus-visible:ring-ring",
                OUTCOME_STYLE[o]
              )}
            >
              <input
                type="radio"
                name={`outcome-${problemId}`}
                className="sr-only"
                checked={draft.outcome === o}
                onChange={() => update({ outcome: o })}
              />
              <span className="text-14 font-medium">{t(`outcome.${o}`)}</span>
              <span className="text-12 text-muted-foreground">{t(`attempt.outcomeHint.${o}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={minutesId} className="text-14">
          {t("attempt.minutes")}
        </label>
        <input
          id={minutesId}
          type="number"
          min={1}
          max={600}
          inputMode="numeric"
          className={cn(INPUT, "w-24")}
          value={draft.minutes}
          onChange={(e) => update({ minutes: e.target.value })}
        />
      </div>

      <fieldset>
        <legend className="mb-1.5 text-14 font-medium">{t("attempt.mistakes")}</legend>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-4 gap-y-1">
          {MISTAKES.map((m) => (
            <label key={m} className="flex cursor-pointer items-center gap-2 py-1 text-14">
              <Checkbox
                checked={draft.mistakes.includes(m)}
                onCheckedChange={(checked) =>
                  update({
                    mistakes:
                      checked === true
                        ? [...draft.mistakes, m]
                        : draft.mistakes.filter((x) => x !== m),
                  })
                }
              />
              {t(`mistake.${m}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor={noteId} className="block text-14 font-medium">
          {t("attempt.note")}
        </label>
        <Textarea
          id={noteId}
          className={cn(FIELD, "min-h-20")}
          value={draft.note}
          placeholder={t("attempt.notePlaceholder")}
          onChange={(e) => update({ note: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={codeId} className="flex-1 text-14 font-medium">
            {t("attempt.code")}
          </label>
          <label htmlFor={langId} className="sr-only">
            {t("attempt.lang")}
          </label>
          <select
            id={langId}
            className={SELECT}
            value={codeLang}
            onChange={(e) => uiActions.setCodeLang(e.target.value)}
          >
            {Object.entries(CODE_LANG_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <Textarea
          id={codeId}
          className={cn(FIELD, "min-h-40 font-mono text-13 leading-[1.6] [tab-size:4] md:text-13")}
          wrap="off"
          spellCheck={false}
          value={draft.code}
          placeholder={t("attempt.codePlaceholder")}
          onChange={(e) => update({ code: e.target.value })}
          onKeyDown={(e) => insertTab(e, (code) => update({ code }))}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!draft.outcome}>
          {t("attempt.save")}
        </Button>
        {!draft.outcome && <span className="text-12 text-faint">{t("attempt.pickOutcome")}</span>}
      </div>
    </form>
  )
}
