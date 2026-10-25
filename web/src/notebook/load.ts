import type { Content } from "@/content/load"
import type { Lang } from "@/i18n/languages"
import { KEYS, storage } from "@/lib/storage"
import { migrateProgress, withDefaultTopics } from "@/notebook/migrate"
import { emptyNotebook, parseNotebook, type Notebook } from "@/notebook/schema"
import { loadSavedProgress } from "@/progress/legacy"

const savedCodeLang = () => {
  const value = storage.get(KEYS.codeLang)
  return typeof value === "string" ? value : "python"
}

/**
 * The notebook saved on this device. The first time (no notebook yet) it is made from the
 * default topics plus whatever progress the old roadmap app left in this browser; the old
 * progress itself is left where it was.
 */
export function loadSavedNotebook(content: Content, lang: Lang): Notebook {
  const saved = parseNotebook(storage.get(KEYS.notebook))
  if (saved) return withDefaultTopics(saved, lang)

  const fresh = withDefaultTopics(emptyNotebook(), lang)
  const notebook = migrateProgress(
    fresh,
    loadSavedProgress(content.phases),
    content,
    lang,
    savedCodeLang()
  )
  storage.set(KEYS.notebook, notebook)
  return notebook
}
