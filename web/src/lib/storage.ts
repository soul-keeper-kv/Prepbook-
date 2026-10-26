// localStorage with JSON values. The keys and the JSON encoding are the ones the previous
// (plain JS) app used, so progress and settings carry over to this version untouched.

export const KEYS = {
  // The notebook (notebook/schema.ts) and its Drive sync state
  notebook: "prep_notebook_v1",
  notebookSync: "prep_drive_sync",
  /** The notebook as last synced with Drive: the base of the next three-way merge */
  notebookBase: "prep_drive_base",
  /** Folders open in the sidebar tree (this device only) */
  treeExpanded: "prep_tree_expanded",
  /** Sort of the pattern pages' problem tables (this device only) */
  problemSort: "prep_problem_sort",
  // Progress of the old roadmap: read once to carry it into the notebook, then left alone
  progress: "dsa_progress_v3",
  driveSync: "dsa_drive_sync",
  lang: "dsa_lang",
  theme: "dsa_theme",
  codeLang: "dsa_code_lang",
  aiMode: "dsa_ai_mode",
  // Progress from versions before v3 (ticks only); migrated once, see progress/legacy.ts
  legacyV2: "dsa_roadmap_v2",
  legacyV1: "dsa_roadmap_v1",
} as const

export const storage = {
  get(key: string): unknown {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as unknown) : null
    } catch {
      return null
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage blocked or full: the app keeps working, it just cannot save
    }
  },
}

/** Reads a string setting, falling back when it is missing or not one of `allowed`. */
export function readChoice<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const value = storage.get(key)
  return allowed.includes(value as T) ? (value as T) : fallback
}
