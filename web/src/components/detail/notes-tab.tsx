import type { KeyboardEvent } from "react"
import { useTranslation } from "react-i18next"
import { InlineText } from "@/components/inline-text"
import { EmptyNote, Section } from "@/components/section"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { useContent } from "@/content/context"
import { useLocalize } from "@/content/localize"
import type { Item } from "@/content/schema"
import { readLang } from "@/i18n/languages"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/time"
import { REVIEW_AFTER_DAYS, itemProgress } from "@/progress/logic"
import { progressActions, useProgressStore } from "@/progress/store"

const FIELD =
  "rounded-sm border-border-strong bg-code px-3 py-2.5 text-14 shadow-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary md:text-14 dark:bg-code"

// Tab in the code box inserts 4 spaces; Shift+Tab still moves focus out
function insertTab(e: KeyboardEvent<HTMLTextAreaElement>, onChange: (value: string) => void) {
  if (e.key !== "Tab" || e.shiftKey) return
  e.preventDefault()
  const el = e.currentTarget
  el.setRangeText("    ", el.selectionStart, el.selectionEnd, "end")
  onChange(el.value)
}

export function NotesTab({ item }: { item: Item }) {
  const { t, i18n } = useTranslation()
  const localize = useLocalize()
  const { checklist } = useContent()
  const p = useProgressStore((s) => itemProgress(s.progress, item.id))
  const lang = readLang(i18n.resolvedLanguage)
  const setCode = (code: string) => progressActions.updateItem(item.id, { code })

  const history = [
    ...(p.doneAt ? [t("history.done", { date: formatDate(p.doneAt, lang) })] : []),
    ...(p.reviews ?? []).map((iso, i) =>
      t("history.review", { n: i + 1, date: formatDate(iso, lang) })
    ),
  ]

  return (
    <>
      {/* Notes and code are saved on every keystroke */}
      <Section title={t("block.notes")}>
        <Textarea
          className={cn(FIELD, "min-h-32")}
          rows={5}
          value={p.notes ?? ""}
          placeholder={t("notes.placeholder")}
          onChange={(e) => progressActions.updateItem(item.id, { notes: e.target.value })}
        />
      </Section>
      <Section title={t("block.code")}>
        <Textarea
          className={cn(
            FIELD,
            "min-h-72 font-mono text-13 leading-[1.6] [tab-size:4] text-code-foreground md:text-13"
          )}
          rows={12}
          wrap="off"
          spellCheck={false}
          value={p.code ?? ""}
          placeholder={t("code.placeholder")}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => insertTab(e, setCode)}
        />
      </Section>
      {checklist.length > 0 && (
        <Section title={t("block.checklist")}>
          {checklist.map((entry) => (
            <label key={entry.id} className="flex cursor-pointer items-start gap-2.5 py-1 text-14">
              <Checkbox
                className="mt-1"
                checked={Boolean(p.checks?.[entry.id])}
                onCheckedChange={(checked) =>
                  progressActions.setCheck(item.id, entry.id, checked === true)
                }
              />
              <span>
                <InlineText text={localize(entry.text)} />
              </span>
            </label>
          ))}
        </Section>
      )}
      <Section title={t("block.history")}>
        {history.length ? (
          <ul>
            {history.map((row, i) => (
              <li
                key={i}
                className="flex items-center gap-2.5 py-0.5 font-mono text-13 before:size-1.5 before:shrink-0 before:rounded-full before:bg-ok-fill before:content-['']"
              >
                {row}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyNote>{t("history.empty", { days: REVIEW_AFTER_DAYS })}</EmptyNote>
        )}
      </Section>
    </>
  )
}
