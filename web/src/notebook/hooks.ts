import { useTranslation } from "react-i18next"
import { useContent } from "@/content/context"
import { readLang, type Lang } from "@/i18n/languages"
import type { SampleTexts } from "@/notebook/logic"
import type { Notebook } from "@/notebook/schema"
import { useNotebookStore } from "@/notebook/store"
import { samplesFrom } from "@/notebook/suggestions"

/** The whole notebook; the page re-renders on every change (fine at one person's scale) */
export const useNotebook = (): Notebook => useNotebookStore((s) => s.doc)

export function useLang(): Lang {
  const { i18n } = useTranslation()
  return readLang(i18n.resolvedLanguage)
}

/** Sample theory from data/, to tell it apart from what the user wrote (levels, lesson) */
export const useSamples = (): SampleTexts => samplesFrom(useContent())
