import { useRef, useState } from "react"
import { XIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { LearnTab } from "@/components/detail/learn-tab"
import { NotesTab } from "@/components/detail/notes-tab"
import { ProblemsTab } from "@/components/detail/problems-tab"
import {
  FileTabs,
  FileTabsContent,
  FileTabsList,
  FileTabsTrigger,
  TabIcon,
} from "@/components/file-tabs"
import { InlineText } from "@/components/inline-text"
import { ITEM_TYPE_TONE, Tag } from "@/components/tag"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useContent } from "@/content/context"
import type { ItemEntry } from "@/content/load"
import { useLocalize } from "@/content/localize"
import { timeAgo } from "@/lib/time"
import { isToday, itemProgress, lastStudied, needsReview, solvedCount } from "@/progress/logic"
import { progressActions, useProgressStore } from "@/progress/store"
import { uiActions, useUiStore } from "@/state/ui"

const TABS = [
  { id: "learn", icon: "M↓", iconClass: "text-syn-keyword" },
  { id: "problems", icon: "{}", iconClass: "text-syn-function" },
  { id: "notes", icon: "≡", iconClass: "text-syn-comment" },
] as const

type TabId = (typeof TABS)[number]["id"]

export function ItemDialog() {
  const { items } = useContent()
  const openId = useUiStore((s) => s.openId)
  const entry = openId ? items.get(openId) : undefined
  // Keep showing the last item while the dialog animates closed
  const [shown, setShown] = useState(entry)
  if (entry && entry !== shown) setShown(entry)

  return (
    <Dialog open={Boolean(entry)} onOpenChange={(open) => !open && uiActions.closeItem()}>
      {shown && <ItemDialogContent key={shown.item.id} entry={shown} />}
    </Dialog>
  )
}

function ItemDialogContent({ entry }: { entry: ItemEntry }) {
  // There is no DialogTrigger (rows open the dialog through the store), so Radix has nowhere
  // to return focus on close: remember the element that had it and focus it again
  const returnFocus = useRef<HTMLElement | null>(null)

  return (
    <DialogContent
      onOpenAutoFocus={() => {
        returnFocus.current = document.activeElement as HTMLElement | null
      }}
      onCloseAutoFocus={(event) => {
        if (!returnFocus.current?.isConnected) return
        event.preventDefault()
        returnFocus.current.focus()
      }}
      showCloseButton={false}
      aria-describedby={undefined}
      className="flex h-[min(820px,calc(100dvh-48px))] w-[min(860px,calc(100vw-32px))] max-w-none flex-col gap-0 overflow-hidden rounded-lg border border-border-strong bg-card p-0 text-base text-foreground shadow-[0_16px_48px_rgba(0,0,0,.35)] ring-0 max-sm:h-dvh max-sm:w-screen max-sm:rounded-none max-sm:border-0 sm:max-w-none"
    >
      {/* Inside DialogContent, so it unmounts on close and every opening starts on "Learn" */}
      <ItemDetail entry={entry} />
    </DialogContent>
  )
}

function ItemDetail({ entry: { item, phase } }: { entry: ItemEntry }) {
  const { t } = useTranslation()
  const localize = useLocalize()
  const progress = useProgressStore((s) => s.progress)
  const [tab, setTab] = useState<TabId>("learn")
  const scroller = useRef<HTMLDivElement>(null)

  const p = itemProgress(progress, item.id)
  const last = lastStudied(p)
  const lastReview = p.reviews?.at(-1)
  const reviewedToday = Boolean(lastReview && isToday(lastReview))
  const problems = item.problems ?? []

  function selectTab(next: string) {
    setTab(next as TabId)
    scroller.current?.scrollTo({ top: 0 })
  }

  return (
    <>
      <header className="flex items-start gap-3 px-5 pt-4 pb-3 max-sm:px-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-12 text-muted-foreground">
            <span>{localize(phase.name)}</span>
            <span className="text-faint" aria-hidden>
              ›
            </span>
            <Tag tone={ITEM_TYPE_TONE[item.type]}>{t(`type.${item.type}`)}</Tag>
          </div>
          <DialogTitle className="mt-1 text-19 leading-[1.35] font-semibold">
            <InlineText text={localize(item.title)} />
          </DialogTitle>
        </div>
        <DialogClose asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t("detail.close")}>
            <XIcon />
          </Button>
        </DialogClose>
      </header>

      <FileTabs value={tab} onValueChange={selectTab} className="flex min-h-0 flex-1 flex-col">
        <div className="flex border-t bg-background">
          <FileTabsList>
            {TABS.map(({ id, icon, iconClass }) => (
              <FileTabsTrigger
                key={id}
                value={id}
                className="border-b border-r-border border-b-border px-4 py-2 text-13 data-[state=active]:border-b-transparent data-[state=active]:bg-card"
              >
                <TabIcon className={iconClass}>{icon}</TabIcon>
                {t(`tab.${id}`)}
                {id === "problems" && problems.length > 0 && (
                  <span className="font-mono text-12 text-faint">
                    {solvedCount(progress, item)}/{problems.length}
                  </span>
                )}
              </FileTabsTrigger>
            ))}
          </FileTabsList>
          <div className="flex-1 border-b" aria-hidden />
        </div>

        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-7 max-sm:px-4">
          <FileTabsContent value="learn" className="space-y-6 outline-none">
            <LearnTab item={item} />
          </FileTabsContent>
          <FileTabsContent value="problems" className="space-y-6 outline-none">
            <ProblemsTab item={item} />
          </FileTabsContent>
          <FileTabsContent value="notes" className="space-y-6 outline-none">
            <NotesTab item={item} />
          </FileTabsContent>
        </div>
      </FileTabs>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-t bg-background px-5 py-2.5 max-sm:px-4">
        <label className="flex cursor-pointer items-center gap-2 text-14">
          <Checkbox
            checked={Boolean(p.done)}
            onCheckedChange={(checked) => progressActions.setDone(item.id, checked === true)}
          />
          {t("foot.done")}
        </label>
        <span className="min-w-0 flex-1 font-mono text-12 text-muted-foreground">
          {last && t("foot.lastStudied", { ago: timeAgo(last, t) })}
          {last && needsReview(progress, item.id) && (
            <>
              {" · "}
              <strong className="text-warn">{t("foot.due")}</strong>
            </>
          )}
        </span>
        <Button onClick={() => progressActions.markReviewed(item.id)} disabled={reviewedToday}>
          {reviewedToday ? t("foot.reviewed") : t("foot.review")}
        </Button>
      </footer>
    </>
  )
}
