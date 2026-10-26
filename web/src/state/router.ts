import { useSyncExternalStore } from "react"

// Screens are addressed by the URL hash (#/pattern/pt_x): works from a static server, from
// the local server and inside the Android app, keeps the back button, and needs no library.

export type Route =
  | { name: "today" }
  | { name: "inbox" }
  | { name: "review" }
  | { name: "topics" }
  | { name: "topic"; id: string }
  | { name: "pattern"; id: string }
  | { name: "problem"; id: string }
  | { name: "graph" }
  | { name: "search" }
  | { name: "settings" }

const SIMPLE = ["inbox", "review", "topics", "graph", "search", "settings"] as const
const WITH_ID = ["topic", "pattern", "problem"] as const

export function parseHash(hash: string): Route {
  const [name, rawId] = hash.replace(/^#\/?/, "").split("/")
  const id = rawId ? decodeURIComponent(rawId) : ""
  if ((WITH_ID as readonly string[]).includes(name ?? "") && id) {
    return { name: name as (typeof WITH_ID)[number], id }
  }
  if ((SIMPLE as readonly string[]).includes(name ?? "")) {
    return { name: name as (typeof SIMPLE)[number] }
  }
  return { name: "today" }
}

export const href = {
  today: "#/",
  inbox: "#/inbox",
  review: "#/review",
  topics: "#/topics",
  graph: "#/graph",
  search: "#/search",
  settings: "#/settings",
  topic: (id: string) => `#/topic/${encodeURIComponent(id)}`,
  pattern: (id: string) => `#/pattern/${encodeURIComponent(id)}`,
  problem: (id: string) => `#/problem/${encodeURIComponent(id)}`,
}

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange)
  return () => window.removeEventListener("hashchange", onChange)
}

const getHash = () => window.location.hash

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash, () => "")
  return parseHash(hash)
}

export function navigate(to: string) {
  if (window.location.hash !== to) window.location.hash = to
}

// Back must know whether the previous history entry is a page of this app or the tab was
// opened straight on this URL. Each entry is tagged with how many app pages lie before it.

const depthOf = (state: unknown) =>
  typeof state === "object" && state !== null && "depth" in state && typeof state.depth === "number"
    ? state.depth
    : undefined

let depth = 0

if (typeof window !== "undefined") {
  const known = depthOf(window.history.state)
  if (known === undefined) window.history.replaceState({ depth }, "")
  else depth = known
  window.addEventListener("hashchange", () => {
    const tagged = depthOf(window.history.state)
    if (tagged !== undefined) {
      // Back, forward, or replace()
      depth = tagged
    } else {
      // A new entry: a link, navigate() or a hash typed in the address bar
      depth += 1
      window.history.replaceState({ depth }, "")
    }
  })
}

/** Like navigate, but swaps the current history entry instead of adding one */
export function replace(to: string) {
  if (window.location.hash === to) return
  window.history.replaceState({ depth }, "", to)
  window.dispatchEvent(new HashChangeEvent("hashchange"))
}

/** Back one app page; when there is none, go to `fallback` without leaving the app */
export function goBack(fallback: string) {
  if (depth > 0) window.history.back()
  else replace(fallback)
}
