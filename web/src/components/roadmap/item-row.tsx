import { memo } from "react"
import { useTranslation } from "react-i18next"
import { InlineText } from "@/components/inline-text"
import { ITEM_TYPE_TONE, Tag } from "@/components/tag"
import { Checkbox } from "@/components/ui/checkbox"
import { useLocalize } from "@/content/localize"
import type { Item } from "@/content/schema"
import { cn } from "@/lib/utils"
import { itemProgress, needsReview, solvedCount } from "@/progress/logic"
import { progressActions, useProgressStore } from "@/progress/store"
import { uiActions } from "@/state/ui"

// Memoised, and each selector returns a value or the item's own progress object, so typing a
// note in one item re-renders that row only, not all of them
export const ItemRow = memo(function ItemRow({ item }: { item: Item }) {
  const { t } = useTranslation()
  const localize = useLocalize()
  const p = useProgressStore((s) => itemProgress(s.progress, item.id))
  const solved = useProgressStore((s) => solvedCount(s.progress, item))
  const due = useProgressStore((s) => needsReview(s.progress, item.id))
  const done = Boolean(p.done)
  const problems = item.problems ?? []

  const meta: string[] = []
  if (problems.length) meta.push(t("item.problems", { solved, total: problems.length }))
  if (p.reviews?.length) meta.push(t("item.reviews", { count: p.reviews.length }))
  if (p.notes || p.code) meta.push(t("item.hasNotes"))

  return (
    // before: the vertical guide joining the items of one folder, as in VS Code's tree
    <div className="group/item relative flex items-start gap-2.5 border-t py-1.5 pr-3 pl-9.5 before:absolute before:inset-y-0 before:left-4.75 before:w-px before:bg-border-strong before:content-[''] hover:bg-muted">
      <Checkbox
        className="mt-1.25"
        checked={done}
        onCheckedChange={(checked) => progressActions.setDone(item.id, checked === true)}
        aria-label={t("item.markDone")}
      />
      <button
        type="button"
        onClick={() => uiActions.openItem(item.id)}
        className="group/open flex min-w-0 flex-1 cursor-pointer flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-sm py-0.5 text-left text-14 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className={cn("group-hover/open:text-link", done && "text-faint line-through")}>
          <InlineText text={localize(item.title)} />
        </span>
        <Tag tone={ITEM_TYPE_TONE[item.type]}>{t(`type.${item.type}`)}</Tag>
        {due && <Tag tone="warn">{t("tag.review")}</Tag>}
        {meta.length > 0 && (
          <span className="basis-full font-mono text-12 text-faint">{meta.join(" · ")}</span>
        )}
      </button>
    </div>
  )
})
