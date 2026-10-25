import { describe, expect, it } from "vitest"
import { buildContent, dataFiles, loadContent, MANIFEST_FILE } from "@/content/load"

describe("data/ content", () => {
  it("matches the schema", () => {
    const result = loadContent()
    if (!result.ok) throw result.error // prints the file and the failing fields
    expect(result.content.phases.length).toBeGreaterThan(0)
  })

  it("indexes every item by id", () => {
    const content = buildContent(dataFiles)
    const count = content.phases.reduce((n, p) => n + p.items.length, 0)
    expect(content.items.size).toBe(count)
  })
})

describe("buildContent", () => {
  const manifest = { title: "T", phases: ["a.json", "b.json"] }
  const phase = (id: string, itemId: string) => ({
    id,
    name: id,
    items: [{ id: itemId, type: "theory", title: itemId }],
  })

  it("rejects a duplicated item id across phases", () => {
    const files = new Map<string, unknown>([
      [MANIFEST_FILE, manifest],
      ["a.json", phase("p1", "x")],
      ["b.json", phase("p2", "x")],
    ])
    expect(() => buildContent(files)).toThrow(/b\.json: item id "x" is duplicated/)
  })

  it("names the file and field of a schema error", () => {
    const files = new Map<string, unknown>([
      [MANIFEST_FILE, { ...manifest, phases: ["a.json"] }],
      [
        "a.json",
        { id: "p1", name: "P", items: [{ id: "x", type: "theory", title: "X", keypoint: [] }] },
      ],
    ])
    const result = loadContent(files)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.file).toBe("a.json")
      expect(result.error.message).toMatch(/keypoint/)
    }
  })

  it("reports a phase file missing from data/", () => {
    const files = new Map<string, unknown>([
      [MANIFEST_FILE, { ...manifest, phases: ["gone.json"] }],
    ])
    expect(() => buildContent(files)).toThrow(/gone\.json: file not found/)
  })

  it("accepts one template or a list, and normalises to a list", () => {
    const files = new Map<string, unknown>([
      [MANIFEST_FILE, { ...manifest, phases: ["a.json"] }],
      [
        "a.json",
        {
          id: "p1",
          name: { vi: "Một", en: "One" },
          items: [
            {
              id: "x",
              type: "practice",
              title: "X",
              template: { lang: "python", code: ["a", "b"] },
            },
          ],
        },
      ],
    ])
    const item = buildContent(files).items.get("x")?.item
    expect(item?.template).toEqual([{ lang: "python", code: ["a", "b"] }])
  })
})
