// Supported languages, kept apart from i18n/index.ts so the content schema can use them
// without starting i18next.

export const LANG_CODES = ["vi", "en"] as const
export type Lang = (typeof LANG_CODES)[number]
export const DEFAULT_LANG: Lang = "vi"

export const LANGUAGES: { code: Lang; label: string; name: string; locale: string }[] = [
  { code: "vi", label: "VI", name: "Tiếng Việt", locale: "vi-VN" },
  { code: "en", label: "EN", name: "English", locale: "en-US" },
]

export const readLang = (code: string | undefined): Lang =>
  LANG_CODES.includes(code as Lang) ? (code as Lang) : DEFAULT_LANG

export const localeOf = (lang: Lang) => LANGUAGES.find((l) => l.code === lang)?.locale
