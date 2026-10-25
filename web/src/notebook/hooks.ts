import { useTranslation } from "react-i18next"
import { readLang, type Lang } from "@/i18n/languages"
import type { Notebook } from "@/notebook/schema"
import { useNotebookStore } from "@/notebook/store"

/** The whole notebook; the page re-renders on every change (fine at one person's scale) */
export const useNotebook = (): Notebook => useNotebookStore((s) => s.doc)

export function useLang(): Lang {
  const { i18n } = useTranslation()
  return readLang(i18n.resolvedLanguage)
}
