import type { TFunction } from "i18next"
import { describe, expect, it } from "vitest"
import { solutionLinks, sourceOf } from "@/content/problems"

const t = ((key: string) => key) as unknown as TFunction
const noGuideTitle = () => undefined

describe("sourceOf", () => {
  it("names known sites and falls back to the host", () => {
    expect(sourceOf("https://leetcode.com/problems/two-sum/")).toBe("LeetCode")
    expect(sourceOf("https://www.hackerrank.com/challenges/x")).toBe("HackerRank")
    expect(sourceOf("https://example.org/p/1")).toBe("example.org")
    expect(sourceOf("not a url")).toBe("")
  })
})

describe("solutionLinks", () => {
  it("builds LeetCode editorial and solutions pages from the problem URL", () => {
    const links = solutionLinks(
      { title: "Two Sum", url: "https://leetcode.com/problems/two-sum/description/" },
      "Two Sum",
      t,
      noGuideTitle
    )
    expect(links.map((l) => l.url)).toEqual([
      "https://leetcode.com/problems/two-sum/editorial/",
      "https://leetcode.com/problems/two-sum/solutions/",
      "https://www.youtube.com/results?search_query=LeetCode%20Two%20Sum%20explained",
    ])
  })

  it("puts guides from the data first and searches the web for unknown sites", () => {
    const links = solutionLinks(
      {
        title: "Dice",
        url: "https://cses.fi/problemset/task/1633",
        guides: [{ url: "https://usaco.guide/dice" }],
      },
      "Dice",
      t,
      noGuideTitle
    )
    expect(links[0]).toEqual({ label: "usaco.guide", url: "https://usaco.guide/dice" })
    expect(links[1]?.label).toBe("help.web")
    expect(links[1]?.url).toContain("google.com/search")
  })
})
