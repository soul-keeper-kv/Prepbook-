import { describe, expect, it } from "vitest"
import { mergeProgress, needsReview, sameProgress, REVIEW_AFTER_DAYS } from "@/progress/logic"
import type { Progress } from "@/progress/schema"

const DAY = 24 * 60 * 60 * 1000
const now = Date.parse("2026-10-25T12:00:00Z")
const daysAgo = (n: number) => new Date(now - n * DAY).toISOString()

describe("mergeProgress", () => {
  const base: Progress = {
    items: { a: { done: true, notes: "base note" }, b: { done: true } },
    solved: { u1: "2026-01-01" },
  }
  const winner: Progress = {
    items: { a: { notes: "winner note" }, c: { done: true } },
    solved: { u2: "2026-02-02" },
  }

  it("keeps items from both sides and lets the winner win per field", () => {
    expect(mergeProgress(base, winner)).toEqual({
      items: { a: { done: true, notes: "winner note" }, b: { done: true }, c: { done: true } },
      solved: { u1: "2026-01-01", u2: "2026-02-02" },
    })
  })

  it("does not change its inputs", () => {
    const before = JSON.stringify(base)
    mergeProgress(base, winner)
    expect(JSON.stringify(base)).toBe(before)
  })
})

describe("needsReview", () => {
  const progress = (p: Progress["items"][string]): Progress => ({ items: { x: p }, solved: {} })

  it("is due once the last study is REVIEW_AFTER_DAYS old", () => {
    expect(needsReview(progress({ done: true, doneAt: daysAgo(REVIEW_AFTER_DAYS) }), "x", now)).toBe(true)
    expect(needsReview(progress({ done: true, doneAt: daysAgo(REVIEW_AFTER_DAYS - 1) }), "x", now)).toBe(false)
  })

  it("counts from the latest review, not from done", () => {
    const p = progress({ done: true, doneAt: daysAgo(30), reviews: [daysAgo(20), daysAgo(2)] })
    expect(needsReview(p, "x", now)).toBe(false)
  })

  it("is never due for an item that is not done", () => {
    expect(needsReview(progress({ done: false, doneAt: daysAgo(30) }), "x", now)).toBe(false)
    expect(needsReview({ items: {}, solved: {} }, "x", now)).toBe(false)
  })
})

describe("sameProgress", () => {
  it("ignores fields set to undefined, as JSON does", () => {
    const a: Progress = { items: { x: { done: false, doneAt: undefined } }, solved: {} }
    const b: Progress = { items: { x: { done: false } }, solved: {} }
    expect(sameProgress(a, b)).toBe(true)
  })
})

describe("sameProgress key order", () => {
  it("treats the same content in another key order as equal", () => {
    const a: Progress = { items: { x: { notes: "n", done: true } }, solved: { u: "d" } }
    const b: Progress = { solved: { u: "d" }, items: { x: { done: true, notes: "n" } } }
    expect(sameProgress(a, b)).toBe(true)
    expect(sameProgress(a, { ...b, solved: {} })).toBe(false)
  })
})
