import { useState } from "react"
import { TriangleAlertIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Markdown } from "@/components/common/markdown"
import { Button } from "@/components/ui/button"
import { useLang, useNotebook } from "@/notebook/hooks"
import { conflictsOf } from "@/notebook/logic"
import { formatDate, formatTime } from "@/lib/time"
import type { Conflict } from "@/notebook/schema"
import { notebookActions } from "@/notebook/store"

/**
 * Texts that lost a merge (the same note edited on two devices before they synced).
 * The newer edit is in place; the other one waits here until the user restores or dismisses it.
 */
export function ConflictList({
  entityIds,
  fieldLabel,
}: {
  entityIds?: string[]
  /** Human name of a field ("sections.idea" -> "Idea") */
  fieldLabel?: (conflict: Conflict) => string
}) {
  const { t } = useTranslation()
  const nb = useNotebook()
  const conflicts = conflictsOf(nb).filter((c) => !entityIds || entityIds.includes(c.entityId))
  if (!conflicts.length) return null
  return (
    <section
      aria-label={t("conflict.title")}
      className="mb-5 rounded-md border border-warn/50 bg-warn-bg px-4 py-3"
    >
      <h2 className="mb-1 flex items-center gap-2 text-14 font-semibold text-warn">
        <TriangleAlertIcon className="size-4" aria-hidden />
        {t("conflict.title")}
      </h2>
      <p className="mb-2 text-13">{t("conflict.intro")}</p>
      <ul className="space-y-2">
        {conflicts.map((c) => (
          <ConflictRow key={c.id} conflict={c} label={fieldLabel?.(c) ?? c.field} />
        ))}
      </ul>
    </section>
  )
}

function ConflictRow({ conflict, label }: { conflict: Conflict; label: string }) {
  const { t } = useTranslation()
  const lang = useLang()
  const [open, setOpen] = useState(false)
  return (
    <li className="rounded-sm border bg-card px-3 py-2">
      <div className="flex flex-wrap items-center gap-2 text-13">
        <span className="min-w-0 flex-1">
          {t("conflict.row", {
            field: label,
            date: `${formatDate(conflict.at, lang)} ${formatTime(conflict.at, lang)}`,
          })}
        </span>
        <Button size="xs" variant="outline" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? t("conflict.hide") : t("conflict.show")}
        </Button>
        <Button
          size="xs"
          variant="outline"
          onClick={() => notebookActions.restoreConflict(conflict.id)}
        >
          {t("conflict.restore")}
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => notebookActions.dismissConflict(conflict.id)}
        >
          {t("conflict.dismiss")}
        </Button>
      </div>
      {open && (
        <div className="mt-2 max-h-80 overflow-y-auto border-t pt-2">
          <Markdown text={conflict.text} />
        </div>
      )}
    </li>
  )
}
