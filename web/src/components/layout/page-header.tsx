import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useContent } from "@/content/context"
import { useLocalize } from "@/content/localize"

export function PageHeader() {
  const { t } = useTranslation()
  const localize = useLocalize()
  const content = useContent()
  const title = localize(content.title)
  const subtitle = localize(content.subtitle)

  useEffect(() => {
    document.title = title || t("app.title")
  }, [title, t])

  return (
    <header className="mb-6">
      {/* after: a blinking terminal cursor */}
      <h1 className="mb-1.5 font-mono text-24 leading-tight font-semibold after:ml-1.5 after:inline-block after:h-[.95em] after:w-[.5em] after:translate-y-[.12em] after:animate-blink after:bg-link after:content-[''] motion-reduce:after:animate-none">
        {title}
      </h1>
      {/* Written like a code comment */}
      {subtitle && (
        <p className="font-mono text-13 text-syn-comment before:content-['//_']">{subtitle}</p>
      )}
    </header>
  )
}
