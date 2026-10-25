// Dates are stored as ISO strings. Scheduling counts in local calendar days: a problem due
// "in 3 days" is due from the start of that day, whatever the hour it was solved.

export const DAY_MS = 24 * 60 * 60 * 1000

export const nowIso = () => new Date().toISOString()

export function startOfDay(time: number | string | Date): number {
  const d = new Date(time)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier) */
export const daysBetween = (from: number | string, to: number | string) =>
  Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS)

export const daysSince = (iso: string, now: number = Date.now()) => daysBetween(iso, now)

export const addDays = (iso: string, days: number) =>
  new Date(new Date(iso).getTime() + days * DAY_MS).toISOString()

export const isToday = (iso: string, now: number = Date.now()) => daysBetween(iso, now) === 0

/** Local date as YYYY-MM-DD, for grouping activity by day */
export function dayKey(time: number | string): string {
  const d = new Date(time)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
