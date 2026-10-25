import { describe, expect, it } from "vitest"
import { mergeNotebooks } from "@/notebook/merge"
import { emptyNotebook, type Notebook, type Pattern, type Problem } from "@/notebook/schema"

const T0 = "2026-10-01T00:00:00.000Z"
const T1 = "2026-10-02T00:00:00.000Z"
const T2 = "2026-10-03T00:00:00.000Z"

const pattern = (
  sections: Record<string, string>,
  updatedAt = T0,
  extra: Partial<Pattern> = {}
): Pattern => ({
  id: "p",
  updatedAt,
  topicId: "t",
  phaseId: null,
  name: "Sliding Window",
  order: 0,
  theory: false,
  sections,
  requires: [],
  related: [],
  createdAt: T0,
  ...extra,
})

const problem = (notes: string, updatedAt = T0, extra: Partial<Problem> = {}): Problem => ({
  id: "pb",
  updatedAt,
  url: "https://leetcode.com/problems/two-sum/",
  title: "Two Sum",
  level: "easy",
  patternIds: ["p"],
  notes,
  createdAt: T0,
  ...extra,
})

function nb(fill: (doc: Notebook) => void): Notebook {
  const doc = emptyNotebook()
  fill(doc)
  return doc
}

describe("mergeNotebooks", () => {
  it("keeps entities that exist on one side only", () => {
    const local = nb((d) => (d.patterns.p = pattern({})))
    const remote = nb((d) => (d.problems.pb = problem("")))
    const merged = mergeNotebooks(null, local, remote)
    expect(Object.keys(merged.patterns)).toEqual(["p"])
    expect(Object.keys(merged.problems)).toEqual(["pb"])
  })

  it("merges a pattern's sections one by one against the base", () => {
    const base = nb((d) => (d.patterns.p = pattern({ idea: "idea", template: "code" })))
    const local = nb(
      (d) => (d.patterns.p = pattern({ idea: "idea, edited on the PC", template: "code" }, T2))
    )
    const remote = nb(
      (d) => (d.patterns.p = pattern({ idea: "idea", template: "code, edited on the phone" }, T1))
    )
    const merged = mergeNotebooks(base, local, remote)
    expect(merged.patterns.p?.sections).toEqual({
      idea: "idea, edited on the PC",
      template: "code, edited on the phone",
    })
    expect(merged.patterns.p?.updatedAt).toBe(T2)
    expect(Object.keys(merged.conflicts)).toHaveLength(0)
  })

  it("on a real conflict the newer edit wins and the other text is kept as a conflict", () => {
    const base = nb((d) => (d.problems.pb = problem("first")))
    const local = nb((d) => (d.problems.pb = problem("typed on the PC", T1)))
    const remote = nb((d) => (d.problems.pb = problem("typed on the phone", T2)))
    const merged = mergeNotebooks(base, local, remote)
    expect(merged.problems.pb?.notes).toBe("typed on the phone")
    const conflicts = Object.values(merged.conflicts)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toMatchObject({
      collection: "problems",
      entityId: "pb",
      field: "notes",
      text: "typed on the PC",
    })
  })

  it("makes the same conflict id on both devices, and never brings back a dismissed one", () => {
    const base = nb((d) => (d.problems.pb = problem("first")))
    const a = nb((d) => (d.problems.pb = problem("A", T1)))
    const b = nb((d) => (d.problems.pb = problem("B", T2)))
    const onPc = mergeNotebooks(base, a, b)
    const onPhone = mergeNotebooks(base, b, a)
    expect(Object.keys(onPc.conflicts)).toEqual(Object.keys(onPhone.conflicts))

    const id = Object.keys(onPc.conflicts)[0]!
    const dismissed = structuredClone(onPc)
    dismissed.conflicts[id] = { ...dismissed.conflicts[id]!, deleted: true }
    expect(mergeNotebooks(base, dismissed, b).conflicts[id]?.deleted).toBe(true)
  })

  it("a delete on one side wins over an untouched copy on the other", () => {
    const base = nb((d) => (d.problems.pb = problem("x")))
    const local = nb((d) => (d.problems.pb = problem("x", T1, { deleted: true })))
    const remote = nb((d) => (d.problems.pb = problem("x")))
    expect(mergeNotebooks(base, local, remote).problems.pb?.deleted).toBe(true)
  })

  it("without a base, every difference is a conflict and nothing typed is lost", () => {
    const local = nb((d) => (d.problems.pb = problem("mine", T2)))
    const remote = nb((d) => (d.problems.pb = problem("theirs", T1)))
    const merged = mergeNotebooks(null, local, remote)
    expect(merged.problems.pb?.notes).toBe("mine")
    expect(Object.values(merged.conflicts).map((c) => c.text)).toEqual(["theirs"])
  })

  it("does not change its inputs", () => {
    const base = nb((d) => (d.problems.pb = problem("first")))
    const local = nb((d) => (d.problems.pb = problem("A", T1)))
    const remote = nb((d) => (d.problems.pb = problem("B", T2)))
    const before = JSON.stringify([base, local, remote])
    mergeNotebooks(base, local, remote)
    expect(JSON.stringify([base, local, remote])).toBe(before)
  })
})
