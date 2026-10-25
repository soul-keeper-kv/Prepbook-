import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "@/index.css"
import { currentLang } from "@/i18n"
import { App } from "@/app"
import { ContentErrorScreen } from "@/components/layout/content-error"
import { ContentProvider } from "@/content/context"
import { loadContent } from "@/content/load"
import { startClock, tick } from "@/lib/clock"
import { initTheme } from "@/lib/theme"
import { loadSavedNotebook } from "@/notebook/load"
import { notebookActions, onLocalNotebookChange } from "@/notebook/store"
import { startDriveSync } from "@/sync"

initTheme()

const root = createRoot(document.getElementById("root")!)
// The old roadmap in data/: suggestions, and the source the old progress is carried over from
const result = loadContent()

if (!result.ok) {
  root.render(
    <StrictMode>
      <ContentErrorScreen error={result.error} />
    </StrictMode>
  )
} else {
  const { content } = result
  notebookActions.init(loadSavedNotebook(content, currentLang()))
  startClock()
  // A change made just now shows up in due dates without waiting for the next minute
  onLocalNotebookChange(tick)
  void startDriveSync()

  root.render(
    <StrictMode>
      <ContentProvider content={content}>
        <App />
      </ContentProvider>
    </StrictMode>
  )
}
