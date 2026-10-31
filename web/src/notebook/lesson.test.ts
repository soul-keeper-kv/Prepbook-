import { describe, expect, it } from "vitest"
import { buildContent } from "@/content/load"
import { problemIdFor } from "@/notebook/ids"
import { nextLessonStep, patternLesson } from "@/notebook/lesson"
import { EPOCH, patternFromItem, withDefaultTopics } from "@/notebook/migrate"
import { emptyNotebook, type Attempt, type Notebook, type Outcome } from "@/notebook/schema"
import { withNote } from "@/notebook/suggestions"

const lc = (slug: string) => `https://leetcode.com/problems/${slug}/`

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
            lesson: { vi: ["## Cửa sổ trượt là gì?", "Hai đầu cùng đi sang phải."] },
            notes: {
              recognition: { vi: ["- liên tiếp"], en: ["- contiguous"] },
              idea: ["Grow right, shrink left"],
              pitfalls: ["- if instead of while"],
            },
            // Not in level order: the lesson picks the easiest, keeping this order within a level
            problems: [
              { title: "Hard one", url: lc("hard-one"), level: "Hard" },
              { title: "Medium A", url: lc("medium-a"), level: "Medium" },
              { title: "Easy one", url: lc("easy-one"), level: "Easy" },
              { title: "Medium B", url: lc("medium-b"), level: "Medium" },
            ],
          },
          { id: "few", title: "Few", problems: [{ title: "Only", url: lc("only") }] },
        ],
      },
    ],
  ])
)

function notebookFor(itemId: string, sections: Record<string, string> = {}): Notebook {
  const nb = withDefaultTopics(emptyNotebook(), "vi")
  const made = patternFromItem(content, itemId, "vi", EPOCH)!
  const pattern = { ...made.pattern, sections }
  return { ...nb, phases: { [made.phase.id]: made.phase }, patterns: { [pattern.id]: pattern } }
}

let seq = 0
function tried(nb: Notebook, url: string, outcome: Outcome): Notebook {
  const problemId = problemIdFor(url)
  const id = `a${++seq}`
  const attempt: Attempt = {
    id,
    updatedAt: EPOCH,
    problemId,
    at: `2026-10-0${seq}T00:00:00.000Z`,
    minutes: 20,
    outcome,
    mistakes: [],
    note: "",
    code: "",
    lang: "",
  }
  return { ...nb, attempts: { ...nb.attempts, [id]: attempt } }
}

const lessonOf = (nb: Notebook) => patternLesson(content, nb, Object.values(nb.patterns)[0]!, "vi")

describe("patternLesson checkpoints", () => {
  it("counts a section only once it holds words of the user's own", () => {
    const nb = notebookFor("win", {
      recognition: "- contiguous", // the English sample, copied while in English
      idea: withNote("Grow right, shrink left", "Mine: the window only moves forward"),
      template: "   ",
    })
    const [recognition, idea, template] = lessonOf(nb).checkpoints
    expect(recognition).toMatchObject({ done: false })
    expect(idea).toMatchObject({ done: true })
    expect(template).toMatchObject({ done: false, note: undefined })
    expect(lessonOf(nb).pitfalls?.text).toBe("- if instead of while")
  })
})

describe("patternLesson practice", () => {
  it("takes the three easiest suggested problems: an example, then two to solve alone", () => {
    const { practice } = lessonOf(notebookFor("win"))
    expect(practice.map((p) => [p.role, p.title])).toEqual([
      ["guided", "Easy one"],
      ["solo", "Medium A"],
      ["solo", "Medium B"],
    ])
    expect(practice.every((p) => !p.linked && !p.done)).toBe(true)
  })

  it("fills in from the pattern's own problems only when data/ has too few", () => {
    const nb = notebookFor("few")
    const patternId = Object.keys(nb.patterns)[0]!
    const id = problemIdFor(lc("mine"))
    nb.problems[id] = {
      id,
      updatedAt: EPOCH,
      url: lc("mine"),
      title: "Mine",
      level: "easy",
      patternIds: [patternId],
      notes: "",
      createdAt: EPOCH,
    }
    const { practice } = lessonOf(nb)
    expect(practice.map((p) => [p.title, p.linked])).toEqual([
      ["Only", false],
      ["Mine", true],
    ])
  })

  it("ticks the example once tried, a solo problem once solved alone", () => {
    let nb = notebookFor("win", { recognition: "a", idea: "b", template: "c" })
    expect(nextLessonStep(lessonOf(nb))).toBe(0)

    nb = tried(nb, lc("medium-a"), "hint")
    let lesson = lessonOf(nb)
    expect(lesson.practice[1]).toMatchObject({ last: "hint", done: false })
    // The example is optional: once solving began, the next step skips it
    expect(nextLessonStep(lesson)).toBe(1)

    nb = tried(tried(nb, lc("easy-one"), "solution"), lc("medium-a"), "alone")
    lesson = lessonOf(nb)
    expect(lesson.practice.map((p) => p.done)).toEqual([true, true, false])
    expect(nextLessonStep(lesson)).toBe(2)
  })

  it("starts with understanding, until a checkpoint holds the user's own words", () => {
    const fresh = lessonOf(notebookFor("win"))
    expect(fresh.explain).toBe("## Cửa sổ trượt là gì?\nHai đầu cùng đi sang phải.")
    expect(nextLessonStep(fresh)).toBe("explain")
    // The sample theory copied in is not the user's words: still understanding first
    expect(nextLessonStep(lessonOf(notebookFor("win", { idea: "Grow right, shrink left" })))).toBe(
      "explain"
    )
    expect(lessonOf(notebookFor("few")).explain).toBeUndefined()
  })

  it("starts with the first checkpoint not held yet", () => {
    expect(nextLessonStep(lessonOf(notebookFor("win", { recognition: "mine" })))).toBe("idea")
  })
})
