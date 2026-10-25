import { describe, expect, it } from "vitest"
import { ProgressSchema } from "@/progress/schema"

describe("ProgressSchema", () => {
  it("keeps a file written by the old app as is", () => {
    const file = {
      savedAt: "2026-10-25T10:00:00.000Z",
      items: {
        a: { done: true, doneAt: "2026-10-01T00:00:00.000Z", notes: "n", checks: { edge: true } },
        b: { reviews: ["2026-10-02T00:00:00.000Z"], code: "x = 1" },
      },
      solved: { "https://leetcode.com/problems/two-sum/": "2026-10-03T00:00:00.000Z" },
    }
    expect(ProgressSchema.parse(file)).toEqual({ items: file.items, solved: file.solved })
  })

  it("drops a wrong field instead of rejecting the whole copy", () => {
    const parsed = ProgressSchema.parse({
      items: { a: { done: true, doneAt: null, notes: 42 }, b: "oops", c: { done: true } },
      solved: { u1: "2026-10-03T00:00:00.000Z", u2: true },
    })
    expect(parsed.items.a?.done).toBe(true)
    expect(parsed.items.a?.doneAt).toBeUndefined()
    expect(parsed.items.a?.notes).toBeUndefined()
    expect(parsed.items.b).toEqual({})
    expect(parsed.items.c).toEqual({ done: true })
    expect(Object.keys(parsed.solved)).toEqual(["u1", "u2"])
  })

  it("keeps fields from a newer version of the app", () => {
    const parsed = ProgressSchema.parse({ items: { a: { done: true, stars: 3 } }, solved: {} })
    expect(parsed.items.a).toEqual({ done: true, stars: 3 })
  })

  it("still rejects something that is not progress at all", () => {
    expect(ProgressSchema.safeParse({ hello: 1 }).success).toBe(false)
    expect(ProgressSchema.safeParse({ items: [], solved: {} }).success).toBe(false)
  })
})
