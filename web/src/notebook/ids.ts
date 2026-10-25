// Ids of notebook entities.
//
// Most are random. A few are derived from content, so two devices that create "the same"
// entity on their own end up with one entity after merging instead of a duplicate:
//   a problem's id comes from its URL (the same link is one problem, whatever pattern it is in)
//   entities carried over from the old roadmap come from the old ids (see migrate.ts)

export const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

/** Two 32-bit FNV-1a hashes with different seeds: about 64 bits, plenty for one person's notes */
function hash(text: string): string {
  let a = 0x811c9dc5
  let b = 0x01000193 ^ text.length
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    a = Math.imul(a ^ c, 0x01000193)
    b = Math.imul(b ^ c, 0x5bd1e995)
  }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36)
}

export const hashId = (prefix: string, key: string) => `${prefix}_${hash(key)}`

/**
 * The part of a link that says which page it is: no scheme, no "www.", no trailing slash,
 * no tracking parameters. LeetCode links also lose everything after the problem's slug
 * (/description/, /editorial/...), so every LeetCode link to one problem is the same problem.
 */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  try {
    const u = new URL(trimmed)
    const host = u.hostname.toLowerCase().replace(/^www\./, "")
    let path = u.pathname.replace(/\/+$/, "")
    let query = ""
    if (host === "leetcode.com" || host === "leetcode.cn") {
      path = path.match(/^\/problems\/[^/]+/i)?.[0].toLowerCase() ?? path
    } else {
      const params = [...u.searchParams].filter(([key]) => !key.startsWith("utm_"))
      if (params.length) query = `?${new URLSearchParams(params)}`
    }
    return `${host}${path}${query}`
  } catch {
    return trimmed.toLowerCase()
  }
}

export const problemIdFor = (url: string) => hashId("pb", normalizeUrl(url))

/** A link the browser can open: adds https:// when it was typed without a scheme */
export function toHref(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ""
  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
}

export const isHttpUrl = (url: string) => {
  try {
    const { protocol } = new URL(toHref(url))
    return protocol === "http:" || protocol === "https:"
  } catch {
    return false
  }
}
