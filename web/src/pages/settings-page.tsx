import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { ConflictList } from "@/components/common/conflicts"
import { PageHeader, Panel } from "@/components/common/page"
import { Segmented } from "@/components/segmented"
import { SyncStatusLine } from "@/components/shell/sync-status"
import { Button } from "@/components/ui/button"
import { useContent } from "@/content/context"
import { LANGUAGES, readLang } from "@/i18n/languages"
import { errorText } from "@/lib/errors"
import { THEMES, setTheme, useThemeStore } from "@/lib/theme"
import { downloadNotebook, readImportFile, type ImportResult } from "@/notebook/files"
import { useLang } from "@/notebook/hooks"
import { notebookActions } from "@/notebook/store"
import { driveSync, useSyncStore } from "@/sync"
import { isNativeApp } from "@/sync/auth"
import { useUiStore } from "@/state/ui"

const BUTTON_STATUSES = new Set(["login", "offline", "error"])

export function SettingsPage() {
  const { t, i18n } = useTranslation()
  const content = useContent()
  const lang = useLang()
  const theme = useThemeStore((s) => s.theme)
  const status = useSyncStore((s) => s.status)
  const codeLang = useUiStore((s) => s.codeLang)
  const fileInput = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<ImportResult | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  async function pickFile(file: File | undefined) {
    if (!file) return
    try {
      setPendingImport(await readImportFile(file, notebookActions.get(), content, lang, codeLang))
    } catch (err) {
      toast.error(t("error.import", { message: errorText(err, t) }))
    }
  }

  return (
    <>
      <PageHeader title={t("nav.settings")} />
      <div className="flex max-w-180 flex-col gap-5">
        <Panel title={t("settings.look")}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <span className="flex items-center gap-2 text-14">
              {t("theme.switch")}
              <Segmented
                label={t("theme.switch")}
                value={theme}
                onChange={setTheme}
                options={THEMES.map((value) => ({ value, label: t(`theme.${value}`) }))}
              />
            </span>
            <span className="flex items-center gap-2 text-14">
              {t("lang.switch")}
              <Segmented
                label={t("lang.switch")}
                value={readLang(i18n.resolvedLanguage)}
                onChange={(code) => void i18n.changeLanguage(code)}
                options={LANGUAGES.map((l) => ({ value: l.code, label: l.label, title: l.name }))}
              />
            </span>
          </div>
          <p className="mt-2 text-12 text-faint">{t("settings.langHint")}</p>
        </Panel>

        <Panel title={t("settings.sync")}>
          <SyncStatusLine />
          {BUTTON_STATUSES.has(status) && (
            <Button className="mt-3" onClick={() => void driveSync.connect()}>
              {status === "login" ? t("sync.connect") : t("sync.retry")}
            </Button>
          )}
        </Panel>

        <ConflictList />

        <Panel title={t("settings.data")}>
          <p className="mb-3 text-13 text-muted-foreground">{t("settings.dataHint")}</p>
          <div className="flex flex-wrap gap-2">
            {/* The Android WebView cannot download files; there the Drive file is the backup */}
            {!isNativeApp() && (
              <Button variant="outline" onClick={() => downloadNotebook(notebookActions.get())}>
                {t("settings.export")}
              </Button>
            )}
            <Button variant="outline" onClick={() => fileInput.current?.click()}>
              {t("settings.import")}
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
              {t("settings.reset")}
            </Button>
          </div>
        </Panel>
      </div>

      <ConfirmDialog
        open={pendingImport !== null}
        onOpenChange={(open) => !open && setPendingImport(null)}
        title={t("confirm.importTitle")}
        description={
          pendingImport?.kind === "progress" ? t("confirm.importOld") : t("confirm.import")
        }
        action={t("confirm.importAction")}
        onConfirm={() => {
          if (pendingImport) notebookActions.replace(pendingImport.doc)
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
        onConfirm={() => notebookActions.resetAll()}
      />
    </>
  )
}
