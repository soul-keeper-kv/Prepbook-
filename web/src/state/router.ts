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
