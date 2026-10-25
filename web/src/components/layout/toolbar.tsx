import { useTranslation } from "react-i18next"
import { Segmented } from "@/components/segmented"
import { ITEM_TYPE_TONE, Tag } from "@/components/tag"
import { Button } from "@/components/ui/button"
import { useContent } from "@/content/context"
import { ITEM_TYPES } from "@/content/schema"
import { needsReview } from "@/progress/logic"
import { progressActions } from "@/progress/store"
import { FILTERS, uiActions, useUiStore, type Filter } from "@/state/ui"

export function Toolbar() {
  const { t } = useTranslation()
  const { phases } = useContent()
  const filter = useUiStore((s) => s.filter)
  const allOpen = useUiStore((s) => phases.every((p) => s.expanded.includes(p.id)))

  function changeFilter(next: Filter) {
    // Items due for review are few and spread out, so open the phases that have some
    const progress = progressActions.get()
    const withDue =
      next === "review"
        ? phases
            .filter((p) => p.items.some((item) => needsReview(progress, item.id)))
            .map((p) => p.id)
        : []
    uiActions.setFilter(next, withDue)
  }

  return (
    <nav className="mb-3 flex flex-wrap items-center gap-2">
      <Segmented
        label={t("filter.label")}
        value={filter}
        onChange={changeFilter}
        options={FILTERS.map((value) => ({ value, label: t(`filter.${value}`) }))}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => uiActions.setExpanded(allOpen ? [] : phases.map((p) => p.id))}
      >
        {allOpen ? t("toolbar.collapse") : t("toolbar.expand")}
      </Button>
      <span className="ml-auto inline-flex gap-1.5 max-sm:ml-0">
        {ITEM_TYPES.map((type) => (
          <Tag key={type} tone={ITEM_TYPE_TONE[type]}>
            {t(`type.${type}`)}
          </Tag>
        ))}
      </span>
    </nav>
  )
}
