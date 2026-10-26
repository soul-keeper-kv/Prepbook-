import { useTranslation } from "react-i18next"
import { errorText } from "@/lib/errors"
import { formatTime } from "@/lib/time"
import { cn } from "@/lib/utils"
import { useLang } from "@/notebook/hooks"
import { useSyncStore } from "@/sync"
import type { SyncStatus } from "@/sync/engine"

const WARN_STATUSES = new Set<SyncStatus>(["setup", "offline", "error", "login"])

function Dot({ status }: { status: SyncStatus }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-2 shrink-0 rounded-full bg-faint",
        status === "synced" && "bg-ok-fill",
        status === "syncing" && "animate-pulse bg-link",
        WARN_STATUSES.has(status) && "bg-warn"
      )}
    />
  )
}

/** The full sentence, for the settings page */
export function SyncStatusLine() {
  const { t } = useTranslation()
  const lang = useLang()
  const { status, error, syncedAt } = useSyncStore()
  const text =
    status === "synced" && syncedAt
      ? t("sync.synced", { time: formatTime(syncedAt, lang) })
      : status === "error"
        ? t("sync.error", { message: errorText(error, t) })
        : t(`sync.${status === "synced" ? "syncing" : status}`)
  return (
    <p
      aria-live="polite"
      className={cn(
        "flex items-start gap-2 text-14",
        WARN_STATUSES.has(status) && status !== "login" && "text-warn"
      )}
    >
      <span className="mt-1.5">
        <Dot status={status} />
      </span>
      {text}
    </p>
  )
}

/** A dot and a few words, for the sidebar */
export function SyncBadge({ className }: { className?: string }) {
  const { t } = useTranslation()
  const lang = useLang()
  const { status, error, syncedAt } = useSyncStore()
  const text =
    status === "synced" && syncedAt
      ? t("sync.short.synced", { time: formatTime(syncedAt, lang) })
      : t(`sync.short.${status}`)
  // The few words may be cut off: hovering shows the full sentence
  const full =
    status === "synced" && syncedAt
      ? t("sync.synced", { time: formatTime(syncedAt, lang) })
      : status === "error"
        ? t("sync.error", { message: errorText(error, t) })
        : t(`sync.${status === "synced" ? "syncing" : status}`)
  return (
    <span
      title={full}
      className={cn("flex min-w-0 items-center gap-2 font-mono text-12", className)}
    >
      <Dot status={status} />
      <span className="truncate">{text}</span>
    </span>
  )
}
