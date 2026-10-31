import { describe, expect, it } from "vitest"
import { addDays } from "@/lib/dates"
import {
  cardDueAt,
  NO_SAMPLES,
  fold,
  patternStatus,
  problemSchedule,
  search,
  streakDays,
  todayTasks,
  type SampleTexts,
} from "@/notebook/logic"
import {
  emptyNotebook,
  type Attempt,
  type Notebook,
  type Outcome,
  type Pattern,
} from "@/notebook/schema"
import { dayKey } from "@/lib/dates"

const NOW = Date.parse("2026-10-25T12:00:00Z")
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

let seq = 0
const attempt = (
  problemId: string,
  at: string,
  outcome: Outcome,
  extra: Partial<Attempt> = {}
): Attempt => ({
  id: `a${++seq}`,
  updatedAt: at,
  problemId,
  at,
  minutes: 20,
  outcome,
  mistakes: [],
  note: "",
  code: "",
  lang: "",
  ...extra,
})

function notebook(
  problems: Record<string, Attempt[]>,
  patternExtra: Partial<Pattern> = {}
): Notebook {
  const nb = emptyNotebook()
  nb.topics.t = {
    id: "t",
    updatedAt: daysAgo(90),
    name: "DSA",
    kind: "dsa",
    color: "blue",
    order: 0,
  }
  nb.patterns.p = {
    id: "p",
    updatedAt: daysAgo(90),
    topicId: "t",
    phaseId: null,
    name: "Sliding Window",
    order: 0,
    theory: false,
    sections: {},
    requires: [],
    related: [],
    createdAt: daysAgo(90),
    ...patternExtra,
  }
  for (const [id, attempts] of Object.entries(problems)) {
    nb.problems[id] = {
      id,
      updatedAt: daysAgo(90),
      url: `https://leetcode.com/problems/${id}/`,
      title: id,
      level: "medium",
      patternIds: ["p"],
      notes: "",
      createdAt: daysAgo(90),
    }
    for (const a of attempts) nb.attempts[a.id] = a
  }
  return nb
}

describe("problemSchedule", () => {
  it("redoes after 1 day when the solution was read, 3 when a hint was needed", () => {
    expect(problemSchedule([attempt("x", daysAgo(0), "solution")]).dueAt).toBe(
      addDays(daysAgo(0), 1)
    )
    expect(problemSchedule([attempt("x", daysAgo(0), "hint")]).dueAt).toBe(addDays(daysAgo(0), 3))
  })

  it("waits longer after each solve alone in a row", () => {
    const one = [attempt("x", daysAgo(30), "hint"), attempt("x", daysAgo(20), "alone")]
    expect(problemSchedule(one).dueAt).toBe(addDays(daysAgo(20), 7))
    const two = [...one, attempt("x", daysAgo(10), "alone")]
    expect(problemSchedule(two).dueAt).toBe(addDays(daysAgo(10), 14))
  })

  it("schedules nothing for a problem only carried over from the old app", () => {
    expect(
      problemSchedule([attempt("x", daysAgo(100), "alone", { imported: true })]).dueAt
    ).toBeNull()
    expect(problemSchedule([]).dueAt).toBeNull()
  })
})

describe("patternStatus", () => {
  it("is not started with nothing, learning with any note", () => {
    expect(patternStatus(notebook({}), notebook({}).patterns.p!, NOW, NO_SAMPLES).level).toBe(0)
    const nb = notebook({}, { sections: { idea: "two pointers" } })
    expect(patternStatus(nb, nb.patterns.p!, NOW, NO_SAMPLES).level).toBe(1)
  })

  it("is not started by what came in with a suggestion: sample theory, untried problems", () => {
    const sample = "Grow right, shrink left"
    const samples: SampleTexts = (_, key) => (key === "idea" ? [sample] : [])
    const nb = notebook({ a: [], b: [] }, { sections: { idea: sample } })
    nb.resources.r = {
      id: "r",
      updatedAt: daysAgo(1),
      url: "https://usaco.guide/silver/two-pointers",
      title: "Two Pointers",
      kind: "article",
      patternIds: ["p"],
      takeaway: "",
      createdAt: daysAgo(1),
    }
    expect(patternStatus(nb, nb.patterns.p!, NOW, samples).level).toBe(0)

    // Each thing the user does starts it: own words, a try, a takeaway
    const own = {
      ...nb,
      patterns: { p: { ...nb.patterns.p!, sections: { idea: `${sample}\n\nmine` } } },
    }
    expect(patternStatus(own, own.patterns.p!, NOW, samples).level).toBe(1)
    const tried = { ...nb, attempts: { x: attempt("a", daysAgo(1), "hint", { id: "x" }) } }
    expect(patternStatus(tried, tried.patterns.p!, NOW, samples).level).toBe(1)
    const read = { ...nb, resources: { r: { ...nb.resources.r!, takeaway: "both ends" } } }
    expect(patternStatus(read, read.patterns.p!, NOW, samples).level).toBe(1)
  })

  it("is 'got it' after 3 problems solved alone", () => {
    const nb = notebook({
      a: [attempt("a", daysAgo(2), "alone")],
      b: [attempt("b", daysAgo(2), "alone")],
      c: [attempt("c", daysAgo(2), "hint")],
    })
    expect(patternStatus(nb, nb.patterns.p!, NOW, NO_SAMPLES).level).toBe(1)
    // The store never edits a notebook in place: a change is a new object
    const next = {
      ...nb,
      attempts: { ...nb.attempts, extra: attempt("c", daysAgo(1), "alone", { id: "extra" }) },
    }
    const status = patternStatus(next, next.patterns.p!, NOW, NO_SAMPLES)
    expect(status.level).toBe(2)
    expect(status.outcomes).toEqual({ alone: 3, hint: 0, solution: 0, todo: 0 })
  })

  it("is mastered when 3 problems were redone alone 7+ days after the first try, nothing late", () => {
    const redone = (id: string) => [
      attempt(id, daysAgo(12), "hint"),
      attempt(id, daysAgo(4), "alone"),
    ]
    const nb = notebook({ a: redone("a"), b: redone("b"), c: redone("c") })
    const status = patternStatus(nb, nb.patterns.p!, NOW, NO_SAMPLES)
    expect(status.reviewedAlone).toBe(3)
    expect(status.level).toBe(3)
  })

  it("drops a level when something is more than 7 days late", () => {
    const nb = notebook({
      a: [attempt("a", daysAgo(40), "alone")], // due 7 days after: 33 days late
      b: [attempt("b", daysAgo(2), "alone")],
      c: [attempt("c", daysAgo(2), "alone")],
    })
    const status = patternStatus(nb, nb.patterns.p!, NOW, NO_SAMPLES)
    expect(status.overdue).toBeGreaterThan(7)
    expect(status.level).toBe(1)
  })

  it("theory: ticked done is 'got it', every card solid is mastered", () => {
    const nb = notebook({}, { theory: true, done: true })
    expect(patternStatus(nb, nb.patterns.p!, NOW, NO_SAMPLES).level).toBe(2)
    const next = { ...nb, cards: { ...nb.cards } }
    next.cards.c = {
      id: "c",
      updatedAt: daysAgo(1),
      patternId: "p",
      question: "Big-O of binary search?",
      answer: "O(log n)",
      reviews: [{ at: daysAgo(1), grade: "solid" }],
      createdAt: daysAgo(3),
    }
    expect(patternStatus(next, next.patterns.p!, NOW, NO_SAMPLES).level).toBe(3)
  })
})

describe("cards", () => {
  it("a new card is due the next day; grades push it back", () => {
    const card = {
      id: "c",
      updatedAt: daysAgo(0),
      patternId: "p",
      question: "q",
      answer: "a",
      reviews: [],
      createdAt: daysAgo(0),
    }
    expect(cardDueAt(card)).toBe(addDays(daysAgo(0), 1))
    expect(cardDueAt({ ...card, reviews: [{ at: daysAgo(0), grade: "fuzzy" as const }] })).toBe(
      addDays(daysAgo(0), 3)
    )
  })
})

describe("todayTasks and streak", () => {
  it("lists due problems first, most late first, then the pattern being learned", () => {
    const nb = notebook({
      late: [attempt("late", daysAgo(5), "solution")],
      due: [attempt("due", daysAgo(3), "hint")],
      fresh: [attempt("fresh", daysAgo(0), "alone")],
    })
    const tasks = todayTasks(nb, NOW, NO_SAMPLES)
    expect(tasks.map((t) => (t.kind === "problem" ? t.problem.id : t.kind))).toEqual([
      "late",
      "due",
      "continue",
    ])
  })

  it("counts days in a row, starting yesterday before today's first activity", () => {
    const activity = new Map(
      [dayKey(daysAgo(1)), dayKey(daysAgo(2)), dayKey(daysAgo(4))].map((k) => [k, 1])
    )
    expect(streakDays(activity, NOW)).toBe(2)
  })
})

describe("search", () => {
  it("finds notes without accents", () => {
    const nb = notebook({}, { sections: { recognition: "Nhận diện: đoạn con liên tiếp" } })
    expect(fold("Đoạn")).toBe("doan")
    expect(search(nb, "doan con").map((h) => h.id)).toEqual(["p"])
    expect(search(nb, "xyz")).toEqual([])
  })
})
