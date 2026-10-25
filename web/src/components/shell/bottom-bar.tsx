import type { ReactNode } from "react"
import { useNow } from "@/lib/clock"
import { HomeIcon, InboxIcon, LayersIcon, RotateCcwIcon, SearchIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { useNotebook } from "@/notebook/hooks"
import { dueCards, dueProblems, inboxOf } from "@/notebook/logic"
import { href, type Route } from "@/state/router"

// Phone navigation: five places always one tap away. The topic tree lives on "Topics".

function Tab({
  to,
  active,
  icon,
  label,
  badge,
}: {
  to: string
  active: boolean
  icon: ReactNode
  label: string
  badge?: number
}) {
  return (
    <a
      href={to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-11 text-muted-foreground no-underline hover:no-underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset [&_svg]:size-5",
        active && "font-semibold text-link"
      )}
    >
      <span aria-hidden>{icon}</span>
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="absolute top-1.5 left-1/2 ml-2 min-w-4 rounded-full bg-primary px-1 text-center font-mono text-[10px] leading-4 text-primary-foreground">
          {badge}
        </span>
      )}
    </a>
  )
}

export function BottomBar({ route, className }: { route: Route; className?: string }) {
  const { t } = useTranslation()
  const nb = useNotebook()
  const now = useNow()
  const due = dueProblems(nb, now).length + dueCards(nb, now).length
  const topicRoutes = new Set<Route["name"]>(["topics", "topic", "pattern", "problem", "graph"])

  return (
    <nav
      aria-label={t("nav.main")}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex border-t bg-background pb-[env(safe-area-inset-bottom)]",
        className
      )}
    >
      <Tab
        to={href.today}
        active={route.name === "today"}
        icon={<HomeIcon />}
        label={t("nav.today")}
      />
      <Tab
        to={href.inbox}
        active={route.name === "inbox"}
        icon={<InboxIcon />}
        label={t("nav.inbox")}
        badge={inboxOf(nb).length}
      />
      <Tab
        to={href.review}
        active={route.name === "review"}
        icon={<RotateCcwIcon />}
        label={t("nav.review")}
        badge={due}
      />
      <Tab
        to={href.topics}
        active={topicRoutes.has(route.name)}
        icon={<LayersIcon />}
        label={t("nav.topics")}
      />
      <Tab
        to={href.search}
        active={route.name === "search"}
        icon={<SearchIcon />}
        label={t("nav.search")}
      />
    </nav>
  )
}
