import type { TFunction } from "i18next"
import { localeOf, type Lang } from "@/i18n/languages"
import { daysSince } from "@/progress/logic"

export const formatDate = (iso: string, lang: Lang) =>
  new Date(iso).toLocaleDateString(localeOf(lang))

export const formatTime = (iso: string, lang: Lang) =>
  new Date(iso).toLocaleTimeString(localeOf(lang), { hour: "2-digit", minute: "2-digit" })

export function timeAgo(iso: string, t: TFunction): string {
  const days = daysSince(iso)
  if (days <= 0) return t("time.today")
  if (days === 1) return t("time.yesterday")
  return t("time.daysAgo", { count: days })
}
