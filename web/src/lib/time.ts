import type { TFunction } from "i18next"
import { localeOf, type Lang } from "@/i18n/languages"
import { daysBetween, daysSince } from "@/lib/dates"

export const formatDate = (iso: string, lang: Lang) =>
  new Date(iso).toLocaleDateString(localeOf(lang))

export const formatShortDate = (iso: string, lang: Lang) =>
  new Date(iso).toLocaleDateString(localeOf(lang), { day: "2-digit", month: "2-digit" })

export const formatTime = (iso: string, lang: Lang) =>
  new Date(iso).toLocaleTimeString(localeOf(lang), { hour: "2-digit", minute: "2-digit" })

export function timeAgo(iso: string, t: TFunction): string {
  const days = daysSince(iso)
  if (days <= 0) return t("time.today")
  if (days === 1) return t("time.yesterday")
  return t("time.daysAgo", { count: days })
}

/** "today", "2 days late", "in 3 days", "not scheduled" */
export function dueText(dueAt: string | null, t: TFunction, now: number = Date.now()): string {
  if (!dueAt) return t("due.none")
  const days = daysBetween(now, dueAt)
  if (days === 0) return t("due.today")
  if (days < 0) return t("due.late", { count: -days })
  return t("due.in", { count: days })
}

/** 25 -> "25 min", 140 -> "2 h 20 min" */
export function durationText(minutes: number, t: TFunction): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (!h) return t("duration.minutes", { count: m })
  if (!m) return t("duration.hours", { count: h })
  return t("duration.hoursMinutes", { h, m })
}
