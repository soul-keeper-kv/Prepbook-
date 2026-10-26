import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { DEFAULT_LANG, LANG_CODES, readLang, type Lang } from "@/i18n/languages"
import type { Localized } from "@/content/schema"

const isLocalized = <T>(value: Localized<T>): value is Partial<Record<Lang, T>> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  LANG_CODES.some((code) => code in value)

/** Picks the current language from a { "vi": ..., "en": ... } field; plain values pass through. */
export function localize<T>(value: Localized<T>, lang: Lang): T
export function localize<T>(value: Localized<T> | undefined, lang: Lang): T | undefined
export function localize<T>(value: Localized<T> | undefined, lang: Lang): T | undefined {
  if (value === undefined || !isLocalized(value)) return value as T | undefined
  return value[lang] ?? value[DEFAULT_LANG] ?? (Object.values(value)[0] as T)
}

export function useLocalize() {
  const { i18n } = useTranslation()
  const lang = readLang(i18n.resolvedLanguage)
  return useCallback(<T>(value: Localized<T> | undefined) => localize(value, lang) as T, [lang])
}
