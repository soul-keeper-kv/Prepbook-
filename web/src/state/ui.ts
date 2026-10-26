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
}

const savedCodeLang = storage.get(KEYS.codeLang)

export const useUiStore = create<UiState>()(() => ({
  codeLang: typeof savedCodeLang === "string" ? savedCodeLang : "python",
  aiMode: readChoice(KEYS.aiMode, AI_MODES, "hint"),
  lastPatternId: null,
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
}
