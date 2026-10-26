import { describe, expect, it } from "vitest"
import { buildContent, dataFiles, loadContent, modulesOf } from "@/content/load"
import { LEGACY_MODULE } from "@/progress/legacy"

describe("data/ content", () => {
  it("matches the schema and the naming rules", () => {
    const result = loadContent()
    if (!result.ok) throw result.error // prints the file and what is wrong
    expect(result.content.modules.length).toBeGreaterThan(0)
  })

  it("indexes every item by id", () => {
    const content = buildContent(dataFiles)
    const count = content.modules.flatMap((m) => m.phases).reduce((n, p) => n + p.items.length, 0)
    expect(content.items.size).toBe(count)
  })

  it("keeps the module the old app's progress is keyed by", () => {
    const content = buildContent(dataFiles)
    expect(content.modules.map((m) => m.id)).toContain(LEGACY_MODULE)
  })
})

describe("buildContent", () => {
  const meta = (topic = "t_dsa") => ({ topic, title: "T" })
  const phase = (id: string, ...itemIds: string[]) => ({
    id,
    name: id,
    items: itemIds.map((itemId) => ({ id: itemId, title: itemId })),
  })
  const build = (entries: [string, unknown][]) => buildContent(new Map(entries))

  it("orders phases by file name and groups modules by topic", () => {
    const content = build([
      ["java/module.json", meta("t_java")],
      ["java/01-collections.json", phase("java-collections", "java-hashmap")],
      ["dsa/module.json", meta()],
      ["dsa/02-later.json", phase("dsa-later", "b")],
      ["dsa/00-first.json", phase("dsa-first", "a")],
    ])
    expect(content.modules.map((m) => m.id)).toEqual(["dsa", "java"])
    expect(content.modules[0]?.phases.map((p) => p.id)).toEqual(["dsa-first", "dsa-later"])
    expect(modulesOf(content, "t_java").map((m) => m.id)).toEqual(["java"])
    expect(content.items.get("java-hashmap")?.module.topicId).toBe("t_java")
  })

  it("rejects an id used twice, even across modules", () => {
    expect(() =>
      build([
        ["dsa/module.json", meta()],
        ["dsa/01-a.json", phase("p1", "x")],
        ["java/module.json", meta("t_java")],
        ["java/01-b.json", phase("p2", "x")],
      ])
    ).toThrow(/java\/01-b\.json: id "x" is already used in dsa\/01-a\.json/)
  })

  it("names the file and field of a schema error", () => {
    const result = loadContent(
      new Map<string, unknown>([
        ["dsa/module.json", meta()],
        ["dsa/01-a.json", { id: "p1", name: "P", items: [{ id: "x", title: "X", resource: [] }] }],
      ])
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.file).toBe("dsa/01-a.json")
      expect(result.error.message).toMatch(/resource/)
    }
  })

  it("rejects an id that is not kebab-case", () => {
    expect(() =>
      build([
        ["dsa/module.json", meta()],
        ["dsa/01-a.json", phase("p1", "Two_Pointers")],
      ])
    ).toThrow(/kebab-case/)
  })

  it("rejects a topic that is not a default one", () => {
    expect(() =>
      build([
        ["dsa/module.json", meta("t_nope")],
        ["dsa/01-a.json", phase("p1", "x")],
      ])
    ).toThrow(/must be one of t_dsa/)
  })

  it("enforces where files sit and how they are named", () => {
    const ok: [string, unknown][] = [["dsa/module.json", meta()]]
    expect(() => build([...ok, ["stray.json", {}]])).toThrow(/stray\.json: must sit directly/)
    expect(() => build([...ok, ["dsa/deep/01-a.json", {}]])).toThrow(/must sit directly/)
    expect(() => build([["Big Module/module.json", meta()]])).toThrow(/kebab-case/)
    expect(() => build([...ok, ["dsa/phase-1.json", {}]])).toThrow(/named like "01-/)
    expect(() => build([...ok, ["dsa/1-a.json", {}]])).toThrow(/named like "01-/)
    expect(() =>
      build([...ok, ["dsa/01-a.json", phase("p1", "x")], ["dsa/01-b.json", phase("p2", "y")]])
    ).toThrow(/dsa\/01-b\.json: order 01 is already used by 01-a\.json/)
  })

  it("needs a module.json and at least one phase per module", () => {
    expect(() => build([["dsa/01-a.json", phase("p1", "x")]])).toThrow(
      /dsa\/module\.json: file not found/
    )
    expect(() => build([["dsa/module.json", meta()]])).toThrow(/has no phase files/)
  })

  it("accepts notes only for the sections of the module's topic", () => {
    const withNotes = (topic: string, notes: unknown) =>
      build([
        ["m/module.json", meta(topic)],
        ["m/01-a.json", { id: "p1", name: "P", items: [{ id: "x", title: "X", notes }] }],
      ])
    const notes = { recognition: { vi: ["- a"], en: "- a" }, template: ["```java", "```"] }
    expect(withNotes("t_dsa", notes).items.get("x")?.item.notes).toEqual(notes)
    expect(() => withNotes("t_sd", notes)).toThrow(
      /item "x": notes\.recognition is not a section of a design topic/
    )
    expect(() => withNotes("t_dsa", { recognize: "-" })).toThrow(/recognize/)
  })
})
