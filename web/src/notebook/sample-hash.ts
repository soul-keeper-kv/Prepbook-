/**
 * Length and FNV-1a hash of a sample note: enough to recognise an old wording in a section
 * without shipping the old text. No imports: scripts/legacy-samples.ts uses it under Node.
 */
export function sampleHash(text: string) {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `${text.length}:${hash.toString(16).padStart(8, "0")}`
}
