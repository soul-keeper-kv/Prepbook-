import { useEffect, useMemo, useState, type ReactNode } from "react"

function useHighlighted(code: string, lang: string): ReactNode | null {
  const key = `${lang}\u0000${code}`
  const [result, setResult] = useState<{ key: string; node: ReactNode } | null>(null)

  useEffect(() => {
    let cancelled = false
    import("@/lib/highlight")
      .then(({ highlight }) => highlight(code, lang))
      .then((node) => {
        if (!cancelled && node) setResult({ key, node })
      })
      .catch(() => {}) // plain text is a fine fallback
    return () => {
      cancelled = true
    }
  }, [code, lang, key])

  return result?.key === key ? result.node : null
}

/**
 * Code laid out like VS Code's editor: line numbers on the left, highlighted code on the right.
 * The gutter is a separate <pre> with the same font and line height, so the lines align, copy
 * does not pick up the numbers, and the numbers stay put when the code scrolls sideways.
 * Until Shiki has loaded the code shows as plain text in the same layout.
 */
export function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const highlighted = useHighlighted(code, lang)
  const lineNumbers = useMemo(
    () =>
      code
        .split("\n")
        .map((_, i) => i + 1)
        .join("\n"),
    [code]
  )

  return (
    <div className="flex bg-code font-mono text-13 leading-[1.6]">
      <pre aria-hidden className="shrink-0 py-3 pr-4 pl-4 text-right text-gutter select-none">
        {lineNumbers}
      </pre>
      <pre
        tabIndex={0}
        className="min-w-0 flex-1 overflow-x-auto py-3 pr-4 text-code-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <code className="shiki-code">{highlighted ?? code}</code>
      </pre>
    </div>
  )
}
