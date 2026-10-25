import { create } from "zustand"
import { KEYS, readChoice, storage } from "@/lib/storage"

// Light / dark theme. "auto" follows the operating system.
// index.html applies the saved choice before React starts; this keeps it in sync afterwards.

export const THEMES = ["auto", "light", "dark"] as const
export type Theme = (typeof THEMES)[number]

const DARK_QUERY = "(prefers-color-scheme: dark)"

interface ThemeState {
  theme: Theme
  resolved: "light" | "dark"
}

const prefersDark = () => window.matchMedia(DARK_QUERY).matches
const resolve = (theme: Theme) =>
  theme === "dark" || (theme === "auto" && prefersDark()) ? "dark" : "light"

const initial = readChoice(KEYS.theme, THEMES, "auto")

export const useThemeStore = create<ThemeState>()(() => ({
  theme: initial,
  resolved: resolve(initial),
}))

function apply(theme: Theme) {
  const resolved = resolve(theme)
  const root = document.documentElement
  root.classList.toggle("dark", resolved === "dark")
  root.classList.toggle("light", resolved === "light")
  useThemeStore.setState({ theme, resolved })
}

export function setTheme(theme: Theme) {
  storage.set(KEYS.theme, theme)
  apply(theme)
}

/** Call once at startup: applies the theme and follows OS changes while on "auto". */
export function initTheme() {
  apply(useThemeStore.getState().theme)
  window.matchMedia(DARK_QUERY).addEventListener("change", () => {
    const { theme } = useThemeStore.getState()
    if (theme === "auto") apply(theme)
  })
}
