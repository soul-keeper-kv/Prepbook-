import { create } from "zustand"

// "Now" for rendering. Due dates and levels depend on the date, and a component must not read
// the clock while rendering (react-hooks/purity): it reads this store instead, which ticks
// every minute, when the app comes back to the foreground, and after every change.

const useClockStore = create<{ now: number }>()(() => ({ now: Date.now() }))

export const tick = () => useClockStore.setState({ now: Date.now() })

export const useNow = () => useClockStore((s) => s.now)

let started = false

/** Call once at startup */
export function startClock() {
  if (started) return
  started = true
  setInterval(tick, 60_000)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") tick()
  })
}
