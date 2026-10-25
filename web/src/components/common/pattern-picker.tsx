import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { INPUT } from "@/components/common/editing"
import { TopicDot } from "@/components/common/badges"
import { Checkbox } from "@/components/ui/checkbox"
import { fold, patternsOfTopic, topicsOf } from "@/notebook/logic"
import { useNotebook } from "@/notebook/hooks"

/** Pick one or more patterns, grouped by topic, with a filter box */
export function PatternPicker({
  value,
  onChange,
  exclude = [],
  label,
}: {
  value: string[]
  onChange: (ids: string[]) => void
  /** Patterns not offered (the pattern being edited) */
  exclude?: string[]
  label: string
}) {
  const { t } = useTranslation()
  const nb = useNotebook()
  const [filter, setFilter] = useState("")
  const filterId = useId()
  const words = fold(filter).split(/\s+/).filter(Boolean)

  const groups = topicsOf(nb)
    .map((topic) => ({
      topic,
      patterns: patternsOfTopic(nb, topic.id).filter(
        (p) =>
          !exclude.includes(p.id) &&
          (value.includes(p.id) || words.every((w) => fold(`${p.name} ${topic.name}`).includes(w)))
      ),
    }))
    .filter((g) => g.patterns.length > 0)

  const toggle = (id: string, on: boolean) =>
    onChange(on ? [...new Set([...value, id])] : value.filter((x) => x !== id))

  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="mb-1 text-13 font-medium">{label}</legend>
      <label htmlFor={filterId} className="sr-only">
        {t("picker.filter")}
      </label>
      <input
        id={filterId}
        className={INPUT}
        value={filter}
        placeholder={t("picker.filter")}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="max-h-56 space-y-2 overflow-y-auto rounded-sm border bg-background px-2.5 py-2">
        {groups.length === 0 && <p className="text-13 text-faint">{t("picker.none")}</p>}
        {groups.map(({ topic, patterns }) => (
          <div key={topic.id}>
            <div className="mb-0.5 flex items-center gap-1.5 text-12 font-semibold text-muted-foreground">
              <TopicDot color={topic.color} />
              {topic.name}
            </div>
            {patterns.map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-center gap-2 py-1 pl-3.5 text-14"
              >
                <Checkbox
                  checked={value.includes(p.id)}
                  onCheckedChange={(checked) => toggle(p.id, checked === true)}
                />
                <span className="min-w-0 truncate">{p.name}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </fieldset>
  )
}
