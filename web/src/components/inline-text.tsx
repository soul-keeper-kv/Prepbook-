import type { ReactNode } from "react"

// Text in data/ may use two bits of Markdown: `code` and **bold**. Nothing else is parsed,
// so other punctuation in lesson text stays as written.
const INLINE = /`([^`]+)`|\*\*([^*]+)\*\*/g

export const INLINE_CODE =
  "rounded-[3px] bg-muted px-1.25 py-px font-mono text-[.88em] text-syn-string"

export function InlineText({ text }: { text: string }) {
  const parts: ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    parts.push(
      match[1] !== undefined ? (
        <code key={match.index} className={INLINE_CODE}>
          {match[1]}
        </code>
      ) : (
        <strong key={match.index}>{match[2]}</strong>
      )
    )
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}

/** Paragraphs split by a blank line; a single newline is a line break */
export function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((paragraph, i) => (
        <p key={i} className="mb-2 last:mb-0">
          {paragraph.split("\n").map((line, j) => (
            <span key={j}>
              {j > 0 && <br />}
              <InlineText text={line} />
            </span>
          ))}
        </p>
      ))}
    </>
  )
}

/** Same text without the markup, for prompts and other plain-text uses */
export const plainText = (text: string) => text.replace(/`|\*\*/g, "")
