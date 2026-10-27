import type { ColumnFiltersState, SortingState } from "@tanstack/react-table"
import { create } from "zustand"
import { AI_MODES, type AiMode } from "@/content/problems"
import { KEYS, readChoice, storage } from "@/lib/storage"

// Preferences of this device that are not part of the notebook

interface UiState {
  /** Language of the code box; the next attempt starts on it too */
  codeLang: string
  /** Kind of prompt sent to the AI from "Stuck?" */
  aiMode: AiMode
  /** The pattern page opened last: a problem in several patterns steps through this one */
  lastPatternId: string | null
  /** Sort of the problem tables, shared by every pattern; empty: the order added */
  problemSort: SortingState
  /** Platform, level and status filters of the problem tables; kept until the app is closed */
  problemFilters: ColumnFiltersState
}

const savedCodeLang = storage.get(KEYS.codeLang)

function readSorting(key: string): SortingState {
  const value = storage.get(key)
  if (!Array.isArray(value)) return []
  return value.flatMap((s: unknown) =>
    typeof s === "object" &&
    s !== null &&
    "id" in s &&
    "desc" in s &&
    typeof s.id === "string" &&
    typeof s.desc === "boolean"
      ? [{ id: s.id, desc: s.desc }]
      : []
  )
}

export const useUiStore = create<UiState>()(() => ({
  codeLang: typeof savedCodeLang === "string" ? savedCodeLang : "python",
  aiMode: readChoice(KEYS.aiMode, AI_MODES, "hint"),
  lastPatternId: null,
  problemSort: readSorting(KEYS.problemSort),
  problemFilters: [],
}))

const set = useUiStore.setState

export const uiActions = {
  setCodeLang: (codeLang: string) => {
    storage.set(KEYS.codeLang, codeLang)
    set({ codeLang })
  },
  setAiMode: (aiMode: AiMode) => {
    storage.set(KEYS.aiMode, aiMode)
    set({ aiMode })
  },
  setLastPattern: (lastPatternId: string) => set({ lastPatternId }),
  setProblemSort: (problemSort: SortingState) => {
    storage.set(KEYS.problemSort, problemSort)
    set({ problemSort })
  },
  setProblemFilters: (problemFilters: ColumnFiltersState) => set({ problemFilters }),
}
