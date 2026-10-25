import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import { DEFAULT_LANG, LANG_CODES, readLang, type Lang } from "@/i18n/languages"
import { KEYS, readChoice, storage } from "@/lib/storage"
import en from "./locales/en.json"
import vi from "./locales/vi.json"

// Text of the app shell (buttons, labels, messages). Roadmap content has its own
// { "vi": ..., "en": ... } fields in data/*.json, see content/localize.ts.
// Adding a language: one entry in languages.ts and one locales/<code>.json with the same keys.

export const resources = {
  vi: { translation: vi },
  en: { translation: en },
} as const

void i18n.use(initReactI18next).init({
  resources,
  lng: readChoice(KEYS.lang, LANG_CODES, DEFAULT_LANG),
  fallbackLng: DEFAULT_LANG,
  supportedLngs: [...LANG_CODES],
  interpolation: { escapeValue: false }, // React escapes already
  initAsync: false,
})

document.documentElement.lang = i18n.language

i18n.on("languageChanged", (lng) => {
  storage.set(KEYS.lang, lng)
  document.documentElement.lang = lng
})

export const currentLang = (): Lang => readLang(i18n.resolvedLanguage)

export default i18n
