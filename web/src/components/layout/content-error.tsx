import { useTranslation } from "react-i18next"
import type { ContentError } from "@/content/load"

/** Shown instead of the app when a file in data/ does not match the schema */
export function ContentErrorScreen({ error }: { error: ContentError }) {
  const { t } = useTranslation()
  return (
    <main className="mx-auto max-w-190 px-4 pt-12 pb-16">
      <h1 className="mb-2 font-mono text-24 font-semibold">{t("error.contentTitle")}</h1>
      <p className="mb-4">{t("error.contentHint")}</p>
      <pre className="overflow-x-auto rounded-sm border border-destructive/40 bg-danger-bg px-3 py-2.5 font-mono text-13 whitespace-pre-wrap text-destructive">
        {error.message}
      </pre>
    </main>
  )
}
