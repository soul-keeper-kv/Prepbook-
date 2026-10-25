import type { ParseKeys, TFunction } from "i18next"

/** An error whose message is an i18n key, so it follows a language switch. */
export class AppError extends Error {
  readonly key: ParseKeys
  readonly params: Record<string, string>

  constructor(key: ParseKeys, params: Record<string, string> = {}) {
    super(key)
    this.name = "AppError"
    this.key = key
    this.params = params
  }
}

// t() cannot check a key that is only known at run time; AppError's constructor already did
type LooseT = (key: string, options?: Record<string, string>) => string

export function errorText(error: unknown, t: TFunction): string {
  if (error instanceof AppError) return (t as unknown as LooseT)(error.key, error.params)
  if (error instanceof Error) return error.message
  return String(error)
}
