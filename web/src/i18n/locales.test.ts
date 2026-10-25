import { expect, it } from "vitest"
import en from "@/i18n/locales/en.json"
import vi from "@/i18n/locales/vi.json"

// Plural forms differ per language (English has _one, Vietnamese only _other), so compare
// keys without the plural suffix
function keys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null)
    return [prefix.replace(/_(zero|one|two|few|many|other)$/, "")]
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k))
}

it("every language has the same keys", () => {
  expect([...new Set(keys(en))].sort()).toEqual([...new Set(keys(vi))].sort())
})
