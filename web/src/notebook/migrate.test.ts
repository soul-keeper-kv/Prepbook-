import { describe, expect, it } from "vitest"
import { buildContent, dataFiles } from "@/content/load"
import { problemIdFor } from "@/notebook/ids"
import { mergeNotebooks } from "@/notebook/merge"
import { EPOCH, migrateProgress, withDefaultTopics } from "@/notebook/migrate"
import { emptyNotebook } from "@/notebook/schema"
import { patternIdFor } from "@/notebook/suggestions"
import type { Progress } from "@/progress/schema"

const content = buildContent(dataFiles)
const firstPhase = content.phases[0]!
const withProblems = content.phases
  .flatMap((p) => p.items)
  .find((i) => (i.problems?.length ?? 0) > 1)!
const url = withProblems.problems![0]!.url

const old: Progress = {
  items: {
    [firstPhase.items[0]!.id]: {
      done: true,
      notes: "pick one language",
      doneAt: "2026-09-01T00:00:00.000Z",
    },
    [withProblems.id]: { code: "def f(): pass" },
  },
  solved: { [url]: "2026-09-10T00:00:00.000Z" },
}

describe("migrateProgress", () => {
  const start = withDefaultTopics(emptyNotebook(), "vi")
  const nb = migrateProgress(start, old, content, "vi", "python")

  it("makes a pattern of every old item with progress, carrying notes and code", () => {
    const first = nb.patterns[patternIdFor(firstPhase.items[0]!.id)]
    expect(first?.sections.idea).toBe("pick one language")
    expect(first?.topicId).toBe("t_dsa")
    const coded = nb.patterns[patternIdFor(withProblems.id)]
    expect(coded?.sections.template).toBe("```python\ndef f(): pass\n```")
    expect(Object.keys(nb.patterns)).toHaveLength(2)
  })

  it("turns a solved tick into a problem with one imported 'alone' attempt", () => {
    const problem = nb.problems[problemIdFor(url)]
    expect(problem?.patternIds).toContain(patternIdFor(withProblems.id))
    const attempts = Object.values(nb.attempts)
    expect(attempts).toHaveLength(1)
    expect(attempts[0]).toMatchObject({
      outcome: "alone",
      imported: true,
      at: "2026-09-10T00:00:00.000Z",
    })
  })

  it("is the same on two devices, so merging them makes no duplicates or conflicts", () => {
    const again = migrateProgress(
      withDefaultTopics(emptyNotebook(), "vi"),
      old,
      content,
      "vi",
      "python"
    )
    expect(again).toEqual(nb)
    const merged = mergeNotebooks(null, nb, again)
    expect(merged).toEqual(nb)
  })

  it("leaves a pattern the user deleted alone, and fills only empty sections", () => {
    const id = patternIdFor(firstPhase.items[0]!.id)
    const deleted = structuredClone(nb)
    deleted.patterns[id] = { ...deleted.patterns[id]!, deleted: true }
    expect(migrateProgress(deleted, old, content, "vi", "python").patterns[id]?.deleted).toBe(true)

    const edited = structuredClone(nb)
    edited.patterns[id] = { ...edited.patterns[id]!, sections: { idea: "my own words" } }
    expect(migrateProgress(edited, old, content, "vi", "python").patterns[id]?.sections.idea).toBe(
      "my own words"
    )
  })

  it("adds the six default topics once, dated so any edit is newer", () => {
    expect(Object.keys(start.topics)).toHaveLength(6)
    expect(start.topics.t_dsa?.updatedAt).toBe(EPOCH)
    const renamed = structuredClone(start)
    renamed.topics.t_dsa = { ...renamed.topics.t_dsa!, deleted: true }
    expect(withDefaultTopics(renamed, "en").topics.t_dsa?.deleted).toBe(true)
  })
})
