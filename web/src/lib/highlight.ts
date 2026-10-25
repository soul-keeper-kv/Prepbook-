import { transformerColorizedBrackets } from "@shikijs/colorized-brackets"
import type { Root } from "hast"
import { toJsxRuntime } from "hast-util-to-jsx-runtime"
import type { ReactNode } from "react"
import { Fragment, jsx, jsxs } from "react/jsx-runtime"
import { createHighlighterCore, type HighlighterCore, type LanguageInput } from "shiki/core"
import { createJavaScriptRegexEngine } from "shiki/engine/javascript"

// Syntax highlighting with Shiki: VS Code's own TextMate grammars and its Light+ / Dark+
// themes, so template code looks exactly like it does in the editor. Both themes are
// rendered at once as CSS variables; index.css picks one by the .dark class.
// This module is loaded lazily (see components/code-block.tsx), and each grammar is its own
// chunk loaded on first use, so Shiki stays out of the main bundle.

const GRAMMARS: Record<string, () => LanguageInput> = {
  python: () => import("@shikijs/langs/python"),
  java: () => import("@shikijs/langs/java"),
  cpp: () => import("@shikijs/langs/cpp"),
  javascript: () => import("@shikijs/langs/javascript"),
  go: () => import("@shikijs/langs/go"),
}

let highlighter: Promise<HighlighterCore> | null = null
const loading = new Map<string, Promise<void>>()
const cache = new Map<string, ReactNode>()

function getHighlighter() {
  highlighter ??= createHighlighterCore({
    themes: [import("@shikijs/themes/light-plus"), import("@shikijs/themes/dark-plus")],
    langs: [],
    // The JavaScript regex engine avoids shipping the Oniguruma WebAssembly file
    engine: createJavaScriptRegexEngine(),
  })
  return highlighter
}

async function loadGrammar(shiki: HighlighterCore, lang: string, grammar: () => LanguageInput) {
  let promise = loading.get(lang)
  if (!promise) {
    promise = shiki.loadLanguage(grammar())
    loading.set(lang, promise)
  }
  await promise
}

/** The code's lines as React nodes, or null when the language has no grammar here. */
export async function highlight(code: string, lang: string): Promise<ReactNode | null> {
  const grammar = GRAMMARS[lang]
  if (!grammar) return null
  const key = `${lang}\u0000${code}`
  const cached = cache.get(key)
  if (cached !== undefined) return cached

  const shiki = await getHighlighter()
  await loadGrammar(shiki, lang, grammar)

  const hast = shiki.codeToHast(code, {
    lang,
    themes: { light: "light-plus", dark: "dark-plus" },
    defaultColor: false,
    transformers: [
      // Bracket pair colours of VS Code (gold / orchid / blue in Dark+)
      transformerColorizedBrackets(),
      {
        name: "dsa:lines-only",
        // Keep just the lines: the caller draws its own <pre>, with the line-number gutter
        root(root) {
          const pre = root.children[0]
          const codeEl = pre?.type === "element" ? pre.children[0] : undefined
          return {
            type: "root",
            children: codeEl?.type === "element" ? codeEl.children : [],
          } satisfies Root
        },
      },
    ],
  })
  const node = toJsxRuntime(hast, { Fragment, jsx, jsxs })
  cache.set(key, node)
  return node
}
