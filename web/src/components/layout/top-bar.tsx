import { useTranslation } from "react-i18next"
import { Segmented } from "@/components/segmented"
import { LANGUAGES, readLang } from "@/i18n/languages"
import { THEMES, setTheme, useThemeStore } from "@/lib/theme"

export function TopBar() {
  const { t, i18n } = useTranslation()
  const theme = useThemeStore((s) => s.theme)

  return (
    <div className="-mt-4 mb-6 flex flex-wrap items-center justify-end gap-2">
      {/* Decoration only: a terminal prompt */}
      <span className="mr-auto font-mono text-13 text-muted-foreground" aria-hidden>
        <span className="text-ok-fill">❯</span> ~/
        <span className="text-foreground">dsa-roadmap</span>
      </span>
      <Segmented
        label={t("theme.switch")}
        value={theme}
        onChange={setTheme}
        options={THEMES.map((value) => ({ value, label: t(`theme.${value}`) }))}
      />
      <Segmented
        label={t("lang.switch")}
        value={readLang(i18n.resolvedLanguage)}
        onChange={(code) => void i18n.changeLanguage(code)}
        options={LANGUAGES.map((l) => ({ value: l.code, label: l.label, title: l.name }))}
      />
    </div>
  )
}
