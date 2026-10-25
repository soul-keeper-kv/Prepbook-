import { create } from "zustand"
import { AI_MODES, type AiMode } from "@/content/problems"
import { KEYS, readChoice, storage } from "@/lib/storage"

export const FILTERS = ["all", "todo", "review"] as const
export type Filter = (typeof FILTERS)[number]

interface UiState {
  filter: Filter
  /** Ids of the phases shown open */
  expanded: string[]
  /** Item shown in the detail dialog */
  openId: string | null
  /** Template language picked last; other items open on it too */
  codeLang: string
  /** Kind of prompt sent to the AI from "How to solve" */
  aiMode: AiMode
}

const savedCodeLang = storage.get(KEYS.codeLang)

export const useUiStore = create<UiState>()(() => ({
  filter: "all",
  expanded: [],
  openId: null,
  codeLang: typeof savedCodeLang === "string" ? savedCodeLang : "python",
  aiMode: readChoice(KEYS.aiMode, AI_MODES, "hint"),
}))

const set = useUiStore.setState

export const uiActions = {
  setFilter: (filter: Filter, alsoExpand: string[] = []) =>
    set((s) => ({ filter, expanded: [...new Set([...s.expanded, ...alsoExpand])] })),
  setExpanded: (expanded: string[]) => set({ expanded }),
  togglePhase: (id: string) =>
    set((s) => ({
      expanded: s.expanded.includes(id) ? s.expanded.filter((x) => x !== id) : [...s.expanded, id],
    })),
  openItem: (id: string) => set({ openId: id }),
  closeItem: () => set({ openId: null }),
  setCodeLang: (codeLang: string) => {
    storage.set(KEYS.codeLang, codeLang)
    set({ codeLang })
  },
  setAiMode: (aiMode: AiMode) => {
    storage.set(KEYS.aiMode, aiMode)
    set({ aiMode })
  },
}
