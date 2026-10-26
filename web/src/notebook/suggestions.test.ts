import { describe, expect, it } from "vitest"
import { buildContent } from "@/content/load"
import { EPOCH, patternFromItem, withDefaultTopics } from "@/notebook/migrate"
import { emptyNotebook, type Notebook } from "@/notebook/schema"
import { patternSuggestions, withNote } from "@/notebook/suggestions"

const content = buildContent(
  new Map<string, unknown>([
    ["dsa/module.json", { topic: "t_dsa", title: "DSA" }],
    [
      "dsa/01-a.json",
      {
        id: "p1",
        name: "P1",
        items: [
          {
            id: "win",
            title: "Window",
            notes: {
              recognition: { vi: ["- liên tiếp", "- dài nhất"], en: ["- contiguous"] },
              template: ["```java", "int f() { return 0; }", "```"],
            },
          },
        ],
      },
    ],
  ])
)

function notebookWith(sections: Record<string, string>): Notebook {
  const nb = withDefaultTopics(emptyNotebook(), "vi")
  const made = patternFromItem(content, "win", "vi", EPOCH)!
  const pattern = { ...made.pattern, sections }
  return {
    ...nb,
    phases: { [made.phase.id]: made.phase },
    patterns: { [pattern.id]: pattern },
  }
}

describe("patternSuggestions notes", () => {
  it("offers the notes in section order, in the current language", () => {
    const nb = notebookWith({})
    const pattern = Object.values(nb.patterns)[0]!
    const { notes } = patternSuggestions(content, nb, pattern, "vi")
    expect(notes.map((n) => n.key)).toEqual(["recognition", "template"])
    expect(notes[0]).toEqual({ key: "recognition", text: "- liên tiếp\n- dài nhất", copied: false })
    expect(patternSuggestions(content, nb, pattern, "en").notes[0]?.text).toBe("- contiguous")
  })

  it("marks a note copied once the section holds it, and keeps offering it to reread", () => {
    const nb = notebookWith({ recognition: withNote("- my own", "- liên tiếp\n- dài nhất") })
    const pattern = Object.values(nb.patterns)[0]!
    const [recognition, template] = patternSuggestions(content, nb, pattern, "vi").notes
    expect(recognition?.copied).toBe(true)
    expect(template?.copied).toBe(false)
  })
})

describe("withNote", () => {
  it("fills an empty section and appends below what is written", () => {
    expect(withNote("", "B")).toBe("B")
    expect(withNote("  \n", "B")).toBe("B")
    expect(withNote("A\n\n", "B")).toBe("A\n\nB")
  })
})
