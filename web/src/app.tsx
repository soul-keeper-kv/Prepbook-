import { Suspense, lazy, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { BottomBar } from "@/components/shell/bottom-bar"
import { Sidebar } from "@/components/shell/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { InboxPage } from "@/pages/inbox-page"
import { PatternPage } from "@/pages/pattern-page"
import { ProblemPage } from "@/pages/problem-page"
import { ReviewPage } from "@/pages/review-page"
import { SearchPage } from "@/pages/search-page"
import { SettingsPage } from "@/pages/settings-page"
import { TodayPage } from "@/pages/today-page"
import { TopicPage } from "@/pages/topic-page"
import { TopicsPage } from "@/pages/topics-page"
import { href, navigate, useRoute, type Route } from "@/state/router"

// The graph pulls in a canvas force-layout library: loaded only when opened
const GraphPage = lazy(() => import("@/pages/graph-page"))

function RoutePage({ route }: { route: Route }) {
  switch (route.name) {
    case "today":
      return <TodayPage />
    case "inbox":
      return <InboxPage />
    case "review":
      return <ReviewPage />
    case "topics":
      return <TopicsPage />
    case "topic":
      return <TopicPage key={route.id} id={route.id} />
    case "pattern":
      return <PatternPage key={route.id} id={route.id} />
    case "problem":
      return <ProblemPage key={route.id} id={route.id} />
    case "graph":
      return <GraphPage />
    case "search":
      return <SearchPage />
    case "settings":
      return <SettingsPage />
  }
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))

export function App() {
  const route = useRoute()
  const { t } = useTranslation()

  // Ctrl+K anywhere, or "/" outside a text field: search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        navigate(href.search)
      } else if (e.key === "/" && !isTyping(e.target)) {
        e.preventDefault()
        navigate(href.search)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // A new screen starts at the top
  const routeKey = JSON.stringify(route)
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [routeKey])

  return (
    <div className="flex min-h-dvh">
      <Sidebar route={route} className="max-md:hidden" />
      <main className="min-w-0 flex-1 bg-card pb-24 md:pb-0">
        <div className="mx-auto max-w-270 px-4 pt-5 pb-12 md:px-8 md:pt-7">
          <Suspense fallback={<p className="text-14 text-faint">{t("app.loading")}</p>}>
            <RoutePage route={route} />
          </Suspense>
        </div>
      </main>
      <BottomBar route={route} className="md:hidden" />
      <Toaster position="bottom-center" offset={{ bottom: 72 }} mobileOffset={{ bottom: 72 }} />
    </div>
  )
}
