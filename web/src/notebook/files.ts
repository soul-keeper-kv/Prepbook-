import type { Content } from "@/content/load"
import type { Lang } from "@/i18n/languages"
import { nowIso } from "@/lib/dates"
import { AppError } from "@/lib/errors"
import { migrateProgress } from "@/notebook/migrate"
import { parseNotebook, type Notebook } from "@/notebook/schema"
import { ProgressSchema } from "@/progress/schema"

// "Export" / "Import". The Drive file has the same shape, so a copy downloaded from Drive
// imports too. Files exported by the old roadmap app import as well: their progress is
// carried into the current notebook, the same way as on the first start (see migrate.ts).

export function downloadNotebook(doc: Notebook) {
  const json = JSON.stringify({ exportedAt: nowIso(), ...doc }, null, 2)
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }))
  const link = document.createElement("a")
  link.href = url
  link.download = `interview-prep-${nowIso().slice(0, 10)}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export type ImportResult =
  | { kind: "notebook"; doc: Notebook }
  /** Old roadmap progress, already carried into a copy of the current notebook */
  | { kind: "progress"; doc: Notebook }

export async function readImportFile(
  file: File,
  current: Notebook,
  content: Content,
  lang: Lang,
  codeLang: string
): Promise<ImportResult> {
  let json: unknown
  try {
    json = JSON.parse(await file.text())
  } catch (err) {
    throw new AppError("error.invalidJson", { file: file.name, message: (err as Error).message })
  }
  const doc = parseNotebook(json)
  if (doc) return { kind: "notebook", doc }
  const progress = ProgressSchema.safeParse(json)
  if (progress.success) {
    return {
      kind: "progress",
      doc: migrateProgress(current, progress.data, content, lang, codeLang),
    }
  }
  throw new AppError("error.notNotebook")
}
