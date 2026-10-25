/** JSON-like copy with sorted keys and no undefined fields, so key order does not matter */
export function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value === null || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => [k, canonical(v)])
  )
}

export const canonicalJson = (value: unknown) => JSON.stringify(canonical(value)) ?? "undefined"

/** Same content, whatever the key order (edits append keys; parsing reorders them) */
export const deepEqual = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b)
