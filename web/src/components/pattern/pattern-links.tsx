import { useState } from "react"
import { useNow } from "@/lib/clock"
import { PencilIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { LevelMeter } from "@/components/common/badges"
import { PatternPicker } from "@/components/common/pattern-picker"
import { Button } from "@/components/ui/button"
import { useNotebook } from "@/notebook/hooks"
import { getLive, patternStatus } from "@/notebook/logic"
import type { Pattern } from "@/notebook/schema"
import { notebookActions } from "@/notebook/store"
import { href } from "@/state/router"

/** "Learn first" or "Related": links to other patterns, edited with the picker */
export function PatternLinks({
  pattern,
  field,
  title,
  emptyText,
}: {
  pattern: Pattern
  field: "requires" | "related"
  title: string
  emptyText: string
}) {
  const { t } = useTranslation()
  const nb = useNotebook()
  const [editing, setEditing] = useState(false)
  const now = useNow()
  const linked = pattern[field].map((id) => getLive(nb.patterns, id)).filter((p) => p !== undefined)

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <h3 className="flex-1 text-13 font-semibold">{title}</h3>
        <Button
          size="xs"
          variant="ghost"
          aria-expanded={editing}
          aria-label={t("edit.editNamed", { name: title })}
          onClick={() => setEditing((e) => !e)}
        >
          <PencilIcon />
          {editing ? t("edit.done") : t("edit.edit")}
        </Button>
      </div>
      {editing ? (
        <PatternPicker
          label={title}
          value={pattern[field]}
          exclude={[pattern.id]}
          onChange={(ids) => notebookActions.updatePattern(pattern.id, { [field]: ids })}
        />
      ) : linked.length ? (
        <ul className="space-y-1">
          {linked.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-14">
              <LevelMeter level={patternStatus(nb, p, now).level} />
              <a href={href.pattern(p.id)} className="min-w-0 truncate">
                {p.name}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-13 text-faint">{emptyText}</p>
      )}
    </div>
  )
}
