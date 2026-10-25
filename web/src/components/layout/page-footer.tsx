import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { readLang } from "@/i18n/languages"
import { errorText } from "@/lib/errors"
import { formatTime } from "@/lib/time"
import { cn } from "@/lib/utils"
import { downloadProgress, readProgressFile } from "@/progress/files"
import { emptyProgress } from "@/progress/logic"
import type { Progress } from "@/progress/schema"
import { progressActions } from "@/progress/store"
import { isNativeApp } from "@/sync/auth"
import { driveSync, useSyncStore } from "@/sync"

const WARN_STATUSES = new Set(["setup", "offline", "error"])
const BUTTON_STATUSES = new Set(["login", "offline", "error"])

function SyncStatusLine() {
  const { t, i18n } = useTranslation()
  const { status, error, syncedAt } = useSyncStore()
  const warn = WARN_STATUSES.has(status)

  const text =
    status === "synced" && syncedAt
      ? t("sync.synced", { time: formatTime(syncedAt, readLang(i18n.resolvedLanguage)) })
      : status === "error"
        ? t("sync.error", { message: errorText(error, t) })
        : t(`sync.${status === "synced" ? "syncing" : status}`)

  return (
    <p
      aria-live="polite"
      className={cn(
        "mb-1 flex basis-full items-center gap-2 font-mono text-12 text-muted-foreground",
        warn && "text-warn"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full bg-faint",
          status === "synced" && "bg-ok-fill",
          status === "syncing" && "animate-pulse bg-link",
          warn && "bg-warn"
        )}
      />
      {text}
    </p>
  )
}

export function PageFooter() {
  const { t } = useTranslation()
  const status = useSyncStore((s) => s.status)
  const fileInput = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<Progress | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  async function pickFile(file: File | undefined) {
    if (!file) return
    try {
      setPendingImport(await readProgressFile(file))
    } catch (err) {
      toast.error(t("error.import", { message: errorText(err, t) }))
    }
  }

  return (
    <footer className="mt-6 flex flex-wrap items-center gap-2 border-t pt-4">
      <SyncStatusLine />
      {BUTTON_STATUSES.has(status) && (
        <Button onClick={() => void driveSync.connect()}>
          {status === "login" ? t("sync.connect") : t("sync.retry")}
        </Button>
      )}
      {/* The Android WebView cannot download files; there the Drive file is the backup */}
      {!isNativeApp() && (
        <Button variant="outline" onClick={() => downloadProgress(progressActions.get())}>
          {t("footer.export")}
        </Button>
      )}
      <Button variant="outline" onClick={() => fileInput.current?.click()}>
        {t("footer.import")}
      </Button>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ""
          void pickFile(file)
        }}
      />
      <Button variant="destructive" className="ml-auto" onClick={() => setConfirmReset(true)}>
        {t("footer.reset")}
      </Button>

      <ConfirmDialog
        open={pendingImport !== null}
        onOpenChange={(open) => !open && setPendingImport(null)}
        title={t("confirm.importTitle")}
        description={t("confirm.import")}
        action={t("confirm.importAction")}
        onConfirm={() => {
          if (pendingImport) progressActions.replace(pendingImport)
          toast.success(t("toast.imported"))
        }}
      />
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={t("confirm.resetTitle")}
        description={t("confirm.reset")}
        action={t("confirm.resetAction")}
        destructive
        onConfirm={() => progressActions.replace(emptyProgress())}
      />
    </footer>
  )
}
