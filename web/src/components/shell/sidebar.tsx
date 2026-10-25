import type { ReactNode } from "react"
import { useNow } from "@/lib/clock"
import {
  HomeIcon,
  InboxIcon,
  NetworkIcon,
  RotateCcwIcon,
  SearchIcon,
  SettingsIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { InlineAdd } from "@/components/common/editing"
import { LABEL } from "@/components/section"
import { SyncBadge } from "@/components/shell/sync-status"
import { TopicTree } from "@/components/shell/topic-tree"
import { cn } from "@/lib/utils"
import { useNotebook } from "@/notebook/hooks"
import { dueCards, dueProblems, inboxOf } from "@/notebook/logic"
import { notebookActions } from "@/notebook/store"
import { href, navigate, type Route } from "@/state/router"

function NavLink({
  to,
  active,
  icon,
  label,
  count,
  countClass,
}: {
  to: string
  active: boolean
  icon: ReactNode
  label: string
  count?: number
  countClass?: string
}) {
  return (
    <a
      href={to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-8 items-center gap-2.5 rounded-sm px-2.5 text-14 text-foreground no-underline hover:bg-muted hover:no-underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active && "bg-info-bg font-semibold text-link hover:bg-info-bg"
      )}
    >
      <span className="text-muted-foreground [&_svg]:size-4" aria-hidden>
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {count !== undefined && count > 0 && (
        <span className={cn("font-mono text-12", countClass ?? "text-muted-foreground")}>
          {count}
        </span>
      )}
    </a>
  )
}

export function Sidebar({ route, className }: { route: Route; className?: string }) {
  const { t } = useTranslation()
  const nb = useNotebook()
  const now = useNow()
  const due = dueProblems(nb, now).length + dueCards(nb, now).length
  const inbox = inboxOf(nb).length

  return (
    <aside
      className={cn(
        // Fixed height: the header and the footer stay put, only the tree scrolls (like
        // VS Code's Explorer). The footer must never sit over the tree, however long it is.
        "sticky top-0 flex h-dvh w-64 shrink-0 flex-col gap-4 overflow-hidden border-r bg-background px-2 py-4",
        className
      )}
    >
      <a
        href={href.today}
        className="shrink-0 px-2.5 font-mono text-13 text-muted-foreground no-underline hover:no-underline"
      >
        <span className="text-ok-fill">❯</span> ~/
        <span className="text-foreground">interview-prep</span>
      </a>

      <button
        type="button"
        onClick={() => navigate(href.search)}
        className="mx-1 flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-sm border border-border-strong bg-code px-2.5 text-13 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <SearchIcon className="size-3.5" aria-hidden />
        <span className="flex-1 text-left">{t("nav.search")}</span>
        <kbd className="font-mono text-11">Ctrl K</kbd>
      </button>

      <nav aria-label={t("nav.main")} className="flex shrink-0 flex-col gap-0.5">
        <NavLink
          to={href.today}
          active={route.name === "today"}
          icon={<HomeIcon />}
          label={t("nav.today")}
        />
        <NavLink
          to={href.inbox}
          active={route.name === "inbox"}
          icon={<InboxIcon />}
          label={t("nav.inbox")}
          count={inbox}
          countClass="text-link"
        />
        <NavLink
          to={href.review}
          active={route.name === "review"}
          icon={<RotateCcwIcon />}
          label={t("nav.review")}
          count={due}
          countClass="text-warn"
        />
        <NavLink
          to={href.graph}
          active={route.name === "graph"}
          icon={<NetworkIcon />}
          label={t("nav.graph")}
        />
      </nav>

      <div className="flex min-h-0 flex-1 flex-col">
        <h2 className={cn(LABEL, "mb-1 shrink-0 px-2.5")}>{t("tree.title")}</h2>
        <div className="min-h-0 flex-1 overflow-y-auto pb-2">
          <TopicTree />
          <details className="mt-2 px-1">
            <summary className="cursor-pointer px-1.5 text-12 text-muted-foreground">
              {t("topic.new")}
            </summary>
            <InlineAdd
              className="mt-1.5"
              label={t("topic.add")}
              placeholder={t("topic.namePlaceholder")}
              onAdd={(name) =>
                navigate(href.topic(notebookActions.addTopic(name, "concept", "gray")))
              }
            />
          </details>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 border-t px-1 pt-3">
        <a
          href={href.settings}
          className="flex min-w-0 flex-1 items-center rounded-sm px-1.5 py-1 text-muted-foreground no-underline hover:bg-muted hover:no-underline"
        >
          <SyncBadge />
        </a>
        <a
          href={href.settings}
          aria-label={t("nav.settings")}
          title={t("nav.settings")}
          aria-current={route.name === "settings" ? "page" : undefined}
          className={cn(
            "grid size-8 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground",
            route.name === "settings" && "bg-info-bg text-link"
          )}
        >
          <SettingsIcon className="size-4" aria-hidden />
        </a>
      </div>
    </aside>
  )
}
