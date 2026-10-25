import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "@/index.css"
import "@/i18n"
import { App } from "@/app"
import { ContentErrorScreen } from "@/components/layout/content-error"
import { ContentProvider } from "@/content/context"
import { loadContent } from "@/content/load"
import { initTheme } from "@/lib/theme"
import { loadSavedProgress } from "@/progress/legacy"
import { progressActions } from "@/progress/store"
import { uiActions } from "@/state/ui"
import { startDriveSync } from "@/sync"

initTheme()

const root = createRoot(document.getElementById("root")!)
const result = loadContent()

if (!result.ok) {
  root.render(
    <StrictMode>
      <ContentErrorScreen error={result.error} />
    </StrictMode>
  )
} else {
  const { content } = result
  progressActions.init(loadSavedProgress(content.phases))
  uiActions.setExpanded(content.phases.slice(0, 1).map((p) => p.id))
  void startDriveSync()

  root.render(
    <StrictMode>
      <ContentProvider content={content}>
        <App />
      </ContentProvider>
    </StrictMode>
  )
}
