import type { TFunction } from "i18next"
import type { Problem } from "@/content/schema"

// Everything the "How to solve" panel derives from a problem's URL: where it is from,
// links to solutions, and the prompt handed to an AI chat.

const SOURCES: Record<string, string> = {
  "leetcode.com": "LeetCode",
  "hackerrank.com": "HackerRank",
  "cses.fi": "CSES",
  "atcoder.jp": "AtCoder",
  "codeforces.com": "Codeforces",
  "neetcode.io": "NeetCode",
  "lintcode.com": "LintCode",
  "geeksforgeeks.org": "GeeksforGeeks",
}

/** "LeetCode" for https://leetcode.com/problems/..., the host name for unknown sites */
export function sourceOf(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "")
    return SOURCES[host] ?? host
  } catch {
    return ""
  }
}

/** Filter key of a problem's site: its name, or "none" for a link that is not a URL */
export const platformKey = (url: string) => sourceOf(url) || "none"

type SolutionPageKey = "help.editorial" | "help.solutions" | "help.discussions"

// Solution pages per site: the matched part of the problem URL plus a suffix.
// Sites not listed here (CSES...) get a web search link instead.
const SOLUTION_PAGES: { match: RegExp; pages: [SolutionPageKey, string][] }[] = [
  {
    match: /^https:\/\/leetcode\.com\/problems\/[^/?#]+/i,
    pages: [
      ["help.editorial", "/editorial/"],
      ["help.solutions", "/solutions/"],
    ],
  },
  {
    match: /^https:\/\/(?:www\.)?hackerrank\.com\/challenges\/[^/?#]+/i,
    pages: [
      ["help.editorial", "/editorial"],
      ["help.discussions", "/forum"],
    ],
  },
  {
    match: /^https:\/\/atcoder\.jp\/contests\/[^/?#]+\/tasks\/[^/?#]+/i,
    pages: [["help.editorial", "/editorial"]],
  },
]

export interface SolutionLink {
  label: string
  url: string
}

/** Guides from the data first, then the site's own solution pages, then videos. */
export function solutionLinks(
  problem: Problem,
  title: string,
  t: TFunction,
  localizeGuide: (guide: NonNullable<Problem["guides"]>[number]) => string | undefined
): SolutionLink[] {
  const query = `${sourceOf(problem.url)} ${title}`
  const links: SolutionLink[] = (problem.guides ?? []).map((guide) => ({
    label: localizeGuide(guide) || sourceOf(guide.url),
    url: guide.url,
  }))

  const site = SOLUTION_PAGES.find((s) => s.match.test(problem.url))
  const base = site && problem.url.match(site.match)?.[0]
  if (site && base) {
    links.push(...site.pages.map(([key, path]) => ({ label: t(key), url: base + path })))
  } else {
    links.push({
      label: t("help.web"),
      url: `https://www.google.com/search?q=${encodeURIComponent(`${query} solution explanation`)}`,
    })
  }
  links.push({
    label: t("help.video"),
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${query} explained`)}`,
  })
  return links
}

// Opens the AI chat with the prompt pre-filled through ?q=. That parameter is undocumented and
// may stop working, so the prompt is always copied first: on an empty chat box, just paste.
export const AI_TOOLS = [
  { id: "claude", name: "Claude", url: "https://claude.ai/new?q=" },
  { id: "chatgpt", name: "ChatGPT", url: "https://chatgpt.com/?q=" },
] as const

export const AI_MODES = ["hint", "explain"] as const
export type AiMode = (typeof AI_MODES)[number]
