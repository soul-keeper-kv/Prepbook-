import type { ReactNode } from "react"
import { CodeBlock } from "@/components/code-block"
import { INLINE_CODE } from "@/components/inline-text"
import { cn } from "@/lib/utils"

// The little Markdown the notes need, rendered without a library (the app must stay small and
// work offline): paragraphs, "-" and "1." lists, "#" headings, fenced code (highlighted like
// VS Code), `code`, **bold**, [links](https://...) and bare https:// links.
// Anything else shows as typed.

const LANG_ALIAS: Record<string, string> = {
  py: "python",
  python3: "python",
  js: "javascript",
  ts: "javascript",
  typescript: "javascript",
  jsx: "javascript",
  "c++": "cpp",
  c: "cpp",
  cc: "cpp",
  golang: "go",
  kotlin: "java",
}

export const codeLangOf = (info: string) => {
  const lang = info.trim().split(/\s+/)[0]?.toLowerCase() ?? ""
  return LANG_ALIAS[lang] ?? lang
}

const INLINE =
  /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g

export function MarkdownInline({ text }: { text: string }) {
  const parts: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const key = m.index
    if (m[1] !== undefined) {
      parts.push(
        <code key={key} className={INLINE_CODE}>
          {m[1]}
        </code>
      )
    } else if (m[2] !== undefined) {
      parts.push(<strong key={key}>{m[2]}</strong>)
    } else {
      const url = m[4] ?? m[5] ?? ""
      parts.push(
        <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="break-words">
          {m[3] ?? url}
        </a>
      )
    }
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "h"; text: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "code"; lang: string; code: string }

const BULLET = /^\s*[-*]\s+(.*)$/
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/
const HEADING = /^#{1,6}\s+(.*)$/

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = []
  const lines = text.replace(/\r\n?/g, "\n").split("\n")
  let i = 0
  while (i < lines.length) {
    const line = lines[i] ?? ""
    const fence = line.match(/^\s*```(.*)$/)
    if (fence) {
      const code: string[] = []
      i++
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i] ?? "")) code.push(lines[i++] ?? "")
      i++ // closing fence (or end of text)
      blocks.push({ kind: "code", lang: codeLangOf(fence[1] ?? ""), code: code.join("\n") })
      continue
    }
    if (!line.trim()) {
      i++
      continue
    }
    const heading = line.match(HEADING)
    if (heading) {
      blocks.push({ kind: "h", text: heading[1] ?? "" })
      i++
      continue
    }
    const listKind = BULLET.test(line) ? "ul" : NUMBERED.test(line) ? "ol" : null
    if (listKind) {
      const re = listKind === "ul" ? BULLET : NUMBERED
      const items: string[] = []
      while (i < lines.length && re.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").match(re)?.[1] ?? "")
        i++
      }
      blocks.push({ kind: listKind, items })
      continue
    }
    const para: string[] = []
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() &&
      !/^\s*```/.test(lines[i] ?? "") &&
      !HEADING.test(lines[i] ?? "") &&
      !BULLET.test(lines[i] ?? "") &&
      !NUMBERED.test(lines[i] ?? "")
    ) {
      para.push(lines[i++] ?? "")
    }
    if (para.length) blocks.push({ kind: "p", lines: para })
  }
  return blocks
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = parseBlocks(text)
  return (
    <div className={cn("space-y-2.5 text-14 break-words", className)}>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case "code":
            return (
              <div key={i} className="overflow-hidden rounded-md border">
                <CodeBlock code={block.code} lang={block.lang} />
              </div>
            )
          case "h":
            return (
              <p key={i} className="font-semibold">
                <MarkdownInline text={block.text} />
              </p>
            )
          case "ul":
          case "ol": {
            const List = block.kind
            return (
              <List
                key={i}
                className={cn("space-y-1 pl-5", block.kind === "ul" ? "list-disc" : "list-decimal")}
              >
                {block.items.map((item, j) => (
                  <li key={j}>
                    <MarkdownInline text={item} />
                  </li>
                ))}
              </List>
            )
          }
          case "p":
            return (
              <p key={i}>
                {block.lines.map((line, j) => (
                  <span key={j}>
                    {j > 0 && <br />}
                    <MarkdownInline text={line} />
                  </span>
                ))}
              </p>
            )
        }
      })}
    </div>
  )
}
