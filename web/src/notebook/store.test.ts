import { beforeEach, describe, expect, it } from "vitest"
import { buildContent, dataFiles } from "@/content/load"
import { KEYS, storage } from "@/lib/storage"
import { normalizeUrl, problemIdFor } from "@/notebook/ids"
import { liveValues, patternsOf, phasesOf, problemsOf } from "@/notebook/logic"
import { withDefaultTopics } from "@/notebook/migrate"
import { emptyNotebook } from "@/notebook/schema"
import { notebookActions, onLocalNotebookChange } from "@/notebook/store"

beforeEach(() => {
  notebookActions.init(withDefaultTopics(emptyNotebook(), "vi"))
})

describe("notebookActions", () => {
  it("saves every change and tells sync about it", () => {
    let changes = 0
    const stop = onLocalNotebookChange(() => changes++)
    const phase = notebookActions.addPhase("t_dsa", "Phase 1")
    notebookActions.addPattern("t_dsa", phase, "Two Pointers")
    stop()
    expect(changes).toBe(2)
    const saved = storage.get(KEYS.notebook) as { patterns: Record<string, { name: string }> }
    expect(Object.values(saved.patterns).map((p) => p.name)).toEqual(["Two Pointers"])
  })

  it("treats the same link as one problem, linked to every pattern it is added to", () => {
    const a = notebookActions.addPattern("t_dsa", null, "Sliding Window")
    const b = notebookActions.addPattern("t_dsa", null, "Hashing")
    const id1 = notebookActions.addProblem({
      url: "https://leetcode.com/problems/longest-substring-without-repeating-characters/description/",
      title: "Longest Substring",
      patternIds: [a],
    })
    const id2 = notebookActions.addProblem({
      url: "https://www.leetcode.com/problems/longest-substring-without-repeating-characters/",
      title: "",
      patternIds: [b],
    })
    expect(id1).toBe(id2)
    const doc = notebookActions.get()
    expect(problemsOf(doc, a).map((p) => p.id)).toEqual([id1])
    expect(problemsOf(doc, b).map((p) => p.id)).toEqual([id1])
  })

  it("deleting a pattern deletes the problems only it had, keeps shared ones", () => {
    const a = notebookActions.addPattern("t_dsa", null, "A")
    const b = notebookActions.addPattern("t_dsa", null, "B")
    const shared = notebookActions.addProblem({
      url: "https://x.dev/shared",
      title: "S",
      patternIds: [a, b],
    })
    const own = notebookActions.addProblem({
      url: "https://x.dev/own",
      title: "O",
      patternIds: [a],
    })
    notebookActions.deletePattern(a)
    const doc = notebookActions.get()
    expect(doc.problems[own]?.deleted).toBe(true)
    expect(doc.problems[shared]?.deleted).toBeFalsy()
    expect(doc.problems[shared]?.patternIds).toEqual([b])
  })

  it("moves patterns between phases and keeps the order dense", () => {
    const p1 = notebookActions.addPhase("t_dsa", "P1")
    const p2 = notebookActions.addPhase("t_dsa", "P2")
    const x = notebookActions.addPattern("t_dsa", p1, "X")
    const y = notebookActions.addPattern("t_dsa", p1, "Y")
    const z = notebookActions.addPattern("t_dsa", p2, "Z")
    notebookActions.movePattern(z, "t_dsa", p1, 1)
    const doc = notebookActions.get()
    expect(patternsOf(doc, "t_dsa", p1).map((p) => p.id)).toEqual([x, z, y])
    notebookActions.movePhase(p2, 0)
    expect(phasesOf(notebookActions.get(), "t_dsa").map((p) => p.id)).toEqual([p2, p1])
  })

  it("files an inbox link as a problem and empties the inbox", () => {
    const p = notebookActions.addPattern("t_dsa", null, "Graphs")
    const inbox = notebookActions.addInbox(
      "https://leetcode.com/problems/number-of-islands/",
      "",
      "BFS works"
    )
    notebookActions.fileAsProblem(inbox, {
      url: "https://leetcode.com/problems/number-of-islands/",
      title: "Number of Islands",
      level: "medium",
      patternIds: [p],
    })
    const doc = notebookActions.get()
    expect(liveValues(doc.inbox)).toHaveLength(0)
    const problem = doc.problems[problemIdFor("https://leetcode.com/problems/number-of-islands/")]
    expect(problem).toMatchObject({ title: "Number of Islands", notes: "BFS works" })
  })

  it("an import marks deleted what the file does not have, so sync cannot bring it back", () => {
    const keep = notebookActions.addPattern("t_dsa", null, "Keep")
    const drop = notebookActions.addPattern("t_dsa", null, "Drop")
    const file = structuredClone(notebookActions.get())
    delete file.patterns[drop]
    notebookActions.replace(file)
    const doc = notebookActions.get()
    expect(doc.patterns[keep]?.deleted).toBeFalsy()
    expect(doc.patterns[drop]?.deleted).toBe(true)
  })

  it("restoring a conflict swaps the texts, losing neither", () => {
    const p = notebookActions.addPattern("t_dsa", null, "P")
    notebookActions.setSection(p, "idea", "current")
    const doc = structuredClone(notebookActions.get())
    doc.conflicts.c1 = {
      id: "c1",
      updatedAt: doc.patterns[p]!.updatedAt,
      collection: "patterns",
      entityId: p,
      field: "sections.idea",
      text: "the other device's",
      at: doc.patterns[p]!.updatedAt,
    }
    notebookActions.init(doc)
    notebookActions.restoreConflict("c1")
    const after = notebookActions.get()
    expect(after.patterns[p]?.sections.idea).toBe("the other device's")
    expect(after.conflicts.c1?.text).toBe("current")
  })

  it("adds every suggested item of a phase in one change, and undoes it", () => {
    const content = buildContent(dataFiles)
    const phase = content.phases[1]!
    const ids = phase.items.map((i) => i.id)
    let changes = 0
    const stop = onLocalNotebookChange(() => changes++)
    const added = notebookActions.addSuggestedPatterns(content, ids, "vi")
    stop()
    expect(changes).toBe(1)
    expect(added).toHaveLength(ids.length)
    expect(phasesOf(notebookActions.get(), "t_dsa")).toHaveLength(1)
    // Adding again adds nothing new
    expect(notebookActions.addSuggestedPatterns(content, ids, "vi")).toEqual([])
    notebookActions.deletePatterns(added)
    expect(liveValues(notebookActions.get().patterns)).toHaveLength(0)
  })

  it("start over keeps the default topics, empty", () => {
    notebookActions.addPattern("t_dsa", null, "X")
    notebookActions.resetAll()
    const doc = notebookActions.get()
    expect(liveValues(doc.patterns)).toHaveLength(0)
    expect(liveValues(doc.topics)).toHaveLength(6)
  })
})

describe("normalizeUrl", () => {
  it("ignores scheme, www, trailing slash, LeetCode sub-pages and tracking", () => {
    expect(normalizeUrl("https://www.leetcode.com/problems/two-sum/description/?envType=x")).toBe(
      "leetcode.com/problems/two-sum"
    )
    expect(normalizeUrl("https://www.youtube.com/watch?v=abc&utm_source=x")).toBe(
      "youtube.com/watch?v=abc"
    )
  })
})
