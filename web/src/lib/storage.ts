// localStorage with JSON values. The keys and the JSON encoding are the ones the previous
// (plain JS) app used, so progress and settings carry over to this version untouched.

export const KEYS = {
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
