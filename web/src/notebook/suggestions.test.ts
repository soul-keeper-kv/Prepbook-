import { describe, expect, it } from "vitest"
import { buildContent } from "@/content/load"
import { EPOCH, patternFromItem, withDefaultTopics } from "@/notebook/migrate"
import { emptyNotebook, type Notebook } from "@/notebook/schema"
import { patternSuggestions, pickSuggestedProblems, withNote } from "@/notebook/suggestions"

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

describe("pickSuggestedProblems", () => {
  const p = (title: string, platform: string, level: string) => ({
    url: title,
    title,
    platform,
    level,
  })
  const problems = [
    p("A", "LeetCode", "medium"),
    p("B", "HackerRank", "easy"),
    p("C", "CSES", ""),
    p("D", "LeetCode", "easy"),
    p("E", "none", "hard"),
  ]
  const none = { platform: [], level: [] }
  const titles = (list: { title: string }[]) => list.map((x) => x.title)

  it("keeps what both filters allow, and counts each choice against the other filter", () => {
    const picked = pickSuggestedProblems(
      problems,
      { platform: ["LeetCode"], level: ["easy"] },
      "order"
    )
    expect(titles(picked.shown)).toEqual(["D"])
    // Platform counts follow the level filter, level counts follow the platform filter
    expect(picked.platforms.get("LeetCode")).toBe(1)
    expect(picked.platforms.get("HackerRank")).toBe(1)
    expect(picked.platforms.get("CSES")).toBe(0)
    expect(picked.levels.get("medium")).toBe(1)
    expect(picked.levels.get("none")).toBe(0)
  })

  it("sorts by level or platform, unknown last, ties in the suggested order", () => {
    expect(titles(pickSuggestedProblems(problems, none, "order").shown)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
    ])
    expect(titles(pickSuggestedProblems(problems, none, "level").shown)).toEqual([
      "B",
      "D",
      "A",
      "E",
      "C",
    ])
    expect(titles(pickSuggestedProblems(problems, none, "platform").shown)).toEqual([
      "C",
      "B",
      "A",
      "D",
      "E",
    ])
  })
})
