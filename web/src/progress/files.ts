import { AppError } from "@/lib/errors"
import { nowIso } from "@/progress/logic"
import { ProgressSchema, type Progress } from "@/progress/schema"

// "Export progress" / "Import progress". The Drive file has the same shape, so a copy
// downloaded from Drive imports too, as do files from the older versions of the app.

export function downloadProgress(progress: Progress) {
  const json = JSON.stringify({ exportedAt: nowIso(), ...progress }, null, 2)
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }))
  const link = document.createElement("a")
  link.href = url
  link.download = `dsa-progress-${nowIso().slice(0, 10)}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function readProgressFile(file: File): Promise<Progress> {
  let json: unknown
  try {
    json = JSON.parse(await file.text())
  } catch (err) {
    throw new AppError("error.invalidJson", { file: file.name, message: (err as Error).message })
  }
  const result = ProgressSchema.safeParse(json)
  if (!result.success) throw new AppError("error.notProgress")
  return result.data
}
