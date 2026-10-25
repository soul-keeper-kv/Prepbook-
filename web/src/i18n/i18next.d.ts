import "i18next"
import type vi from "./locales/vi.json"

// Typed t(): a key missing from vi.json is a compile error.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation"
    resources: { translation: typeof vi }
  }
}
