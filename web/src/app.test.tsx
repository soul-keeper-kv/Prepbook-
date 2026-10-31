import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import "@/i18n"
import i18n from "@/i18n"
import { App } from "@/app"
import { ContentProvider } from "@/content/context"
import { buildContent, dataFiles, modulesOf } from "@/content/load"
import { localize } from "@/content/localize"
import { KEYS, storage } from "@/lib/storage"
import { liveValues } from "@/notebook/logic"
import { withDefaultTopics } from "@/notebook/migrate"
import { emptyNotebook, type Notebook } from "@/notebook/schema"
import { notebookActions } from "@/notebook/store"
import { uiActions } from "@/state/ui"

const content = buildContent(dataFiles)

function renderApp() {
  return render(
    <ContentProvider content={content}>
      <App />
    </ContentProvider>
  )
}

async function go(hash: string) {
  await act(async () => {
    window.location.hash = hash
    window.dispatchEvent(new HashChangeEvent("hashchange"))
  })
}

const saved = () => storage.get(KEYS.notebook) as Notebook

beforeEach(async () => {
  await i18n.changeLanguage("vi")
  notebookActions.init(withDefaultTopics(emptyNotebook(), "vi"))
  uiActions.setProblemSort([])
  uiActions.setProblemFilters([])
  uiActions.setSuggestSort("order")
  uiActions.setSuggestFilter("platform", [])
  uiActions.setSuggestFilter("level", [])
  uiActions.setAiMode("hint")
  uiActions.setSolveStepsOpen(true)
  window.location.hash = ""
})

describe("App", () => {
  it("opens on Today with the default topics", () => {
    renderApp()
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Hôm nay chưa có gì đến hạn"
    )
    expect(screen.getAllByText("System Design").length).toBeGreaterThan(0)
  })

  it("builds a roadmap: a phase, a pattern, notes, a problem and an attempt", async () => {
    const user = userEvent.setup()
    renderApp()
    await go("#/topic/t_dsa")
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("DSA")

    await user.type(screen.getByRole("textbox", { name: "Thêm giai đoạn" }), "Giai đoạn 1{Enter}")
    const addPattern = await screen.findAllByRole("textbox", { name: "Thêm pattern" })
    await user.type(addPattern[0]!, "Sliding Window{Enter}")
    const link = await screen.findByRole("link", { name: "Sliding Window" })

    // The pattern page: write the first section
    await user.click(link)
    await waitFor(() => expect(window.location.hash).toMatch(/^#\/pattern\//))
    await act(async () => window.dispatchEvent(new HashChangeEvent("hashchange")))
    await screen.findByRole("heading", { level: 1, name: /Sliding Window/ })
    // A DSA pattern is a learning path: its notes open from their step
    await user.click(screen.getByRole("button", { name: /^Nhận diện/ }))
    await user.click(screen.getByRole("button", { name: "Sửa: Nhận diện" }))
    await user.type(screen.getByRole("textbox", { name: "Nhận diện" }), "đoạn con liên tiếp")
    const pattern = liveValues(saved().patterns).find((p) => p.name === "Sliding Window")!
    expect(pattern.sections.recognition).toBe("đoạn con liên tiếp")

    // Add a problem by its link
    await user.type(
      screen.getByRole("textbox", { name: "Link bài" }),
      "https://leetcode.com/problems/longest-substring-without-repeating-characters/"
    )
    await user.click(screen.getByRole("button", { name: "Thêm bài" }))
    const problem = liveValues(saved().problems)[0]!
    expect(problem.title).toBe("Longest Substring Without Repeating Characters") // known from data/

    // Log an attempt on the problem's page
    await go(`#/problem/${problem.id}`)
    await screen.findByRole("heading", { level: 1, name: /Longest Substring/ })
    expect(screen.getByText("Chưa làm")).toBeInTheDocument()
    await user.click(screen.getByRole("radio", { name: /Cần gợi ý/ }))
    await user.type(screen.getByRole("spinbutton", { name: "Số phút" }), "35")
    await user.click(screen.getByRole("button", { name: "Lưu lần làm" }))
    const attempts = liveValues(saved().attempts)
    expect(attempts).toHaveLength(1)
    expect(attempts[0]).toMatchObject({ outcome: "hint", minutes: 35 })
    // The status comes from the attempts: done, and how the latest one went
    expect(screen.getByText("Đã giải · cần gợi ý")).toBeInTheDocument()
    expect(screen.getByText("1 lần làm")).toBeInTheDocument()
    expect(screen.getByText("Làm lại: sau 3 ngày")).toBeInTheDocument()
    // Three pages and ~100 typed keys, each a save and a render: near 5 s on a busy machine
  }, 15_000)

  it("sorts a pattern's problem table, and the problem page steps in that order", async () => {
    const user = userEvent.setup()
    const pattern = notebookActions.addPattern("t_dsa", null, "Two Pointers")
    const lc = (slug: string) => `https://leetcode.com/problems/${slug}/`
    const [twoSum] = notebookActions.addProblems([
      { url: lc("two-sum"), title: "Two Sum", level: "easy", patternIds: [pattern] },
      { url: lc("4sum"), title: "4Sum", patternIds: [pattern] },
      { url: lc("3sum"), title: "3Sum", level: "medium", patternIds: [pattern] },
    ])
    renderApp()
    await go(`#/pattern/${pattern}`)
    const table = await screen.findByRole("table")
    const order = () =>
      within(screen.getByRole("table"))
        .getAllByRole("link")
        .map((link) => link.textContent)
    expect(order()).toEqual(["Two Sum", "4Sum", "3Sum"]) // the order added

    // Ascending, descending, then the order added again
    const byTitle = within(table).getByRole("button", { name: "Bài" })
    await user.click(byTitle)
    expect(order()).toEqual(["3Sum", "4Sum", "Two Sum"])
    expect(byTitle.closest("th")).toHaveAttribute("aria-sort", "ascending")
    await user.click(byTitle)
    expect(order()).toEqual(["Two Sum", "4Sum", "3Sum"])
    expect(byTitle.closest("th")).toHaveAttribute("aria-sort", "descending")
    await user.click(byTitle)
    expect(byTitle.closest("th")).not.toHaveAttribute("aria-sort")

    // A problem with no level goes last, both ways
    const byLevel = within(table).getByRole("button", { name: "Mức" })
    await user.click(byLevel)
    expect(order()).toEqual(["Two Sum", "3Sum", "4Sum"])
    await user.click(byLevel)
    expect(order()).toEqual(["3Sum", "Two Sum", "4Sum"])
    expect(storage.get(KEYS.problemSort)).toEqual([{ id: "level", desc: true }])

    // The arrows on the problem page follow the sorted table
    await go(`#/problem/${twoSum}`)
    await screen.findByRole("heading", { level: 1, name: /Two Sum/ })
    expect(screen.getByRole("button", { name: "Bài trước: 3Sum" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Bài sau: 4Sum" })).toBeEnabled()

    await go(`#/pattern/${pattern}`)
    await user.click(await screen.findByRole("button", { name: "Về thứ tự đã thêm" }))
    expect(order()).toEqual(["Two Sum", "4Sum", "3Sum"])
    expect(screen.queryByRole("button", { name: "Về thứ tự đã thêm" })).not.toBeInTheDocument()
  })

  it("filters the problem table by level and status, and the arrows follow", async () => {
    const user = userEvent.setup()
    const pattern = notebookActions.addPattern("t_dsa", null, "Two Pointers")
    const lc = (slug: string) => `https://leetcode.com/problems/${slug}/`
    const [alpha, beta, gamma] = notebookActions.addProblems([
      { url: lc("alpha"), title: "Alpha", level: "easy", patternIds: [pattern] },
      // Capitalised, as the old roadmap writes it
      { url: lc("beta"), title: "Beta", level: "Medium", patternIds: [pattern] },
      { url: lc("gamma"), title: "Gamma", level: "medium", patternIds: [pattern] },
      { url: lc("delta"), title: "Delta", patternIds: [pattern] },
    ])
    const attempt = (id: string | undefined, outcome: "alone" | "hint") =>
      notebookActions.logAttempt(id!, {
        outcome,
        minutes: null,
        mistakes: [],
        note: "",
        code: "",
        lang: "",
      })
    attempt(alpha, "alone")
    attempt(beta, "hint")
    renderApp()
    await go(`#/pattern/${pattern}`)
    await screen.findByRole("table")
    const order = () =>
      within(screen.getByRole("table"))
        .getAllByRole("link")
        .map((link) => link.textContent)
    // The filters sit in the column titles: a funnel opens a menu of values
    const openFilter = async (name: RegExp) => {
      await user.click(screen.getByRole("button", { name }))
      return screen.findByRole("menu")
    }
    const option = (menu: HTMLElement, name: RegExp) =>
      within(menu).getByRole("menuitemcheckbox", { name })

    let menu = await openFilter(/^Lọc theo mức/)
    await user.click(option(menu, /^Medium/))
    // The menu stays open, so several values can be picked in a row
    expect(option(menu, /^Medium/)).toHaveAttribute("aria-checked", "true")
    await user.keyboard("{Escape}")
    expect(order()).toEqual(["Beta", "Gamma"])
    expect(screen.getByText("Hiện 2/4 bài")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Lọc theo mức (đang chọn 1)" })).toBeInTheDocument()

    // The status counts only count what the level filter keeps
    menu = await openFilter(/^Lọc theo trạng thái/)
    expect(option(menu, /^Tự làm được/)).toHaveTextContent(/0$/)
    expect(option(menu, /^Cần gợi ý/)).toHaveTextContent(/1$/)
    await user.click(option(menu, /^Chưa làm/))
    await user.keyboard("{Escape}")
    expect(order()).toEqual(["Gamma"])

    menu = await openFilter(/^Lọc theo mức/)
    await user.click(within(menu).getByRole("menuitem", { name: "Bỏ lọc cột này" }))
    expect(order()).toEqual(["Gamma", "Delta"])

    // The arrows on the problem page step through the filtered rows only
    await go(`#/problem/${gamma}`)
    await screen.findByRole("heading", { level: 1, name: /Gamma/ })
    expect(
      screen.getByRole("navigation", { name: "Các bài trong Two Pointers" })
    ).toHaveTextContent("1 / 2")
    expect(screen.getByRole("button", { name: "Bài sau: Delta" })).toBeEnabled()
    // Solved now, so Gamma no longer matches "not done"; the arrows still go on to Delta
    await user.click(screen.getByRole("radio", { name: /Tự làm được/ }))
    await user.click(screen.getByRole("button", { name: "Lưu lần làm" }))
    expect(screen.getByRole("button", { name: "Bài sau: Delta" })).toBeEnabled()

    await go(`#/pattern/${pattern}`)
    await user.click(await screen.findByRole("button", { name: "Bỏ lọc" }))
    expect(order()).toEqual(["Alpha", "Beta", "Gamma", "Delta"])
  })

  it("sorts and filters the problem table by platform", async () => {
    const user = userEvent.setup()
    const pattern = notebookActions.addPattern("t_dsa", null, "Arrays")
    notebookActions.addProblems([
      { url: "https://leetcode.com/problems/two-sum/", title: "Two Sum", patternIds: [pattern] },
      {
        url: "https://www.hackerrank.com/challenges/pairs/problem",
        title: "Pairs",
        patternIds: [pattern],
      },
      {
        url: "https://cses.fi/problemset/task/1068",
        title: "Weird Algorithm",
        patternIds: [pattern],
      },
      { url: "https://leetcode.com/problems/3sum/", title: "3Sum", patternIds: [pattern] },
    ])
    renderApp()
    await go(`#/pattern/${pattern}`)
    const table = await screen.findByRole("table")
    const order = () =>
      within(table)
        .getAllByRole("link")
        .map((link) => link.textContent)
    expect(within(table).getAllByText("LeetCode")).toHaveLength(2)

    await user.click(within(table).getByRole("button", { name: "Nền tảng" }))
    expect(order()).toEqual(["Weird Algorithm", "Pairs", "Two Sum", "3Sum"])
    await user.click(within(table).getByRole("button", { name: "Nền tảng" }))
    expect(order()).toEqual(["Two Sum", "3Sum", "Pairs", "Weird Algorithm"])

    await user.click(screen.getByRole("button", { name: /^Lọc theo nền tảng/ }))
    const menu = await screen.findByRole("menu")
    expect(within(menu).getByRole("menuitemcheckbox", { name: /^LeetCode/ })).toHaveTextContent(
      /2$/
    )
    await user.click(within(menu).getByRole("menuitemcheckbox", { name: /^HackerRank/ }))
    await user.keyboard("{Escape}")
    expect(order()).toEqual(["Pairs"])
    expect(screen.getByText("Hiện 1/4 bài")).toBeInTheDocument()
  })

  it("filters and sorts the suggested problems, and adds only those shown", async () => {
    const user = userEvent.setup()
    const entry = [...content.items.values()].find((e) => {
      const sites = new Set(e.item.problems?.map((p) => new URL(p.url).hostname))
      return sites.has("leetcode.com") && sites.has("www.hackerrank.com")
    })!
    const id = notebookActions.addSuggestedPattern(content, entry.item.id, "vi")!
    // Everything comes in with the pattern: taken out again, the box offers it back
    notebookActions.unlinkProblems(
      liveValues(saved().problems).map((p) => p.id),
      id
    )
    notebookActions.unlinkResources(
      liveValues(saved().resources).map((r) => r.id),
      id
    )
    const noteKeys = Object.keys(saved().patterns[id]!.sections)
    for (const key of noteKeys) notebookActions.setSection(id, key, "")
    const fromLeetCode = entry.item.problems!.filter((p) => p.url.includes("leetcode.com"))
    renderApp()
    await go(`#/pattern/${id}`)
    await screen.findByRole("heading", { level: 1 })
    const total =
      entry.item.problems!.length + (entry.item.resources?.length ?? 0) + noteKeys.length
    expect(screen.getByRole("button", { name: `Thêm tất cả (${total})` })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Nền tảng" }))
    const menu = await screen.findByRole("menu")
    await user.click(within(menu).getByRole("menuitemcheckbox", { name: /^LeetCode/ }))
    await user.keyboard("{Escape}")
    expect(
      screen.getByText(`Hiện ${fromLeetCode.length}/${entry.item.problems!.length} bài`)
    ).toBeInTheDocument()
    expect(screen.queryByText(/^HackerRank/)).not.toBeInTheDocument()

    // By level: easy first
    await user.click(screen.getByRole("button", { name: "Sắp xếp" }))
    await user.click(await screen.findByRole("menuitemradio", { name: "Theo mức" }))
    const levels = screen.getAllByText(/^LeetCode · /).map((el) => el.textContent)
    expect(levels[0]).toBe("LeetCode · easy")
    expect(storage.get(KEYS.suggestSort)).toBe("level")

    // "Add all" adds what is shown: the LeetCode problems, plus the links and the theory
    const added = fromLeetCode.length + (entry.item.resources?.length ?? 0) + noteKeys.length
    await user.click(screen.getByRole("button", { name: `Thêm tất cả (${added})` }))
    const problems = liveValues(saved().problems)
    expect(problems).toHaveLength(fromLeetCode.length)
    expect(problems.every((p) => p.url.includes("leetcode.com"))).toBe(true)
    expect(Object.values(saved().patterns[id]!.sections).every(Boolean)).toBe(true)
  })

  it("steps through a pattern's problems, then goes back to the pattern", async () => {
    const user = userEvent.setup()
    const sorting = notebookActions.addPattern("t_dsa", null, "Sorting")
    const pointers = notebookActions.addPattern("t_dsa", null, "Two Pointers")
    const lc = (slug: string) => `https://leetcode.com/problems/${slug}/`
    notebookActions.addProblem({
      url: lc("sort-colors"),
      title: "Sort Colors",
      patternIds: [sorting],
    })
    const [, threeSum] = notebookActions.addProblems([
      { url: lc("two-sum"), title: "Two Sum", patternIds: [pointers] },
      { url: lc("3sum"), title: "3Sum", patternIds: [sorting, pointers] },
      { url: lc("4sum"), title: "4Sum", patternIds: [pointers] },
    ])
    renderApp()
    await go(`#/pattern/${pointers}`)
    await screen.findByRole("heading", { level: 1, name: /Two Pointers/ })
    await go(`#/problem/${threeSum}`)
    await screen.findByRole("heading", { level: 1, name: /3Sum/ })
    // 3Sum is in two patterns: it steps through the one it was opened from
    expect(
      screen.getByRole("navigation", { name: "Các bài trong Two Pointers" })
    ).toHaveTextContent("2 / 3")

    await user.click(screen.getByRole("button", { name: "Bài sau: 4Sum" }))
    await screen.findByRole("heading", { level: 1, name: /4Sum/ })
    expect(screen.getByRole("button", { name: "Bài sau" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Bài trước: 3Sum" }))
    await screen.findByRole("heading", { level: 1, name: /3Sum/ })

    // Stepping added no history entries: Back skips the problems stepped through
    await user.click(screen.getByRole("button", { name: "Quay lại" }))
    await screen.findByRole("heading", { level: 1, name: /Two Pointers/ })
  })

  it("shows a DSA pattern as a learning path: notes inside, then an example and two to solve", async () => {
    const user = userEvent.setup()
    const pattern = notebookActions.addSuggestedPattern(content, "p1-twoptr", "vi")!
    renderApp()
    await go(`#/pattern/${pattern}`)
    await screen.findByRole("heading", { level: 1, name: /Two Pointers/ })
    const lesson = screen.getByRole("region", { name: "Lộ trình học" })
    expect(lesson).toHaveTextContent("Lý thuyết 0/3 · Bài 0/3")
    // The note sections live inside the path, not below it
    expect(screen.queryByRole("heading", { level: 2, name: /^1. Nhận diện/ })).toBeNull()
    expect(screen.getByRole("heading", { level: 2, name: "1. Bài đã làm" })).toBeInTheDocument()

    // Understanding comes first: the lesson is open, the notes to rewrite are closed
    expect(within(lesson).getByRole("button", { name: /^Hiểu pattern/ })).toHaveAttribute(
      "aria-expanded",
      "true"
    )
    expect(within(lesson).getByRole("heading", { name: "Hai con trỏ là gì?" })).toBeInTheDocument()
    const recognition = within(lesson).getByRole("button", { name: /^Nhận diện/ })
    expect(recognition).toHaveAttribute("aria-expanded", "false")

    // A step opens to its explanation (a table here) and a quiz answered on the spot
    await user.click(recognition)
    expect(
      within(lesson).getByRole("columnheader", { name: "Dấu hiệu trong đề" })
    ).toBeInTheDocument()
    const quiz = within(lesson).getByRole("region", { name: "Luyện nhận diện" })
    await user.click(within(quiz).getByRole("radio", { name: "Cùng chiều (read / write)" }))
    expect(quiz).toHaveTextContent("Chưa đúng.")
    expect(quiz).toHaveTextContent("Câu 1/5 · đúng 0/1")
    await user.click(within(quiz).getByRole("button", { name: "Câu sau" }))
    await user.click(within(quiz).getByRole("radio", { name: "Cùng chiều (read / write)" }))
    expect(quiz).toHaveTextContent("Câu 2/5 · đúng 1/2")

    // The notes, still the copied sample, are folded under the explanation; edited in place
    const notes = within(lesson).getByRole("button", { name: /^Ghi chú của bạn/ })
    expect(notes).toHaveAttribute("aria-expanded", "false")
    await user.click(notes)
    expect(within(lesson).getByRole("button", { name: "Sửa: Nhận diện" })).toBeInTheDocument()

    // Words of your own tick a step; the sample alone does not
    const copied = saved().patterns[pattern]!.sections.idea!
    act(() =>
      notebookActions.setSection(
        pattern,
        "idea",
        `${copied}

Hai đầu đi vào giữa`
      )
    )
    expect(lesson).toHaveTextContent("Lý thuyết 1/3")

    // The three easiest suggested problems: an example to learn from, then two to solve alone
    expect(within(lesson).getByText("Bài mẫu · tuỳ chọn")).toBeInTheDocument()
    expect(within(lesson).getByText("Tự làm 1")).toBeInTheDocument()
    expect(within(lesson).getByText("Tự làm 2")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Học qua bài mẫu" }))
    await act(async () => window.dispatchEvent(new HashChangeEvent("hashchange")))
    await screen.findByRole("heading", { level: 1, name: /Valid Palindrome/ })

    // The example opens its help on the step-by-step explanation, leaving the saved choice alone
    expect(screen.getByText("Bài mẫu · tuỳ chọn")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Bí? Xem gợi ý" })).toHaveAttribute(
      "aria-expanded",
      "true"
    )
    expect(screen.getByRole("radio", { name: "Giải thích từng bước" })).toHaveAttribute(
      "aria-checked",
      "true"
    )
    expect(storage.get(KEYS.aiMode)).toBe("hint")

    // A Java pattern keeps its own sections, with no path
    const java = notebookActions.addPattern("t_java", null, "HashMap")
    await go(`#/pattern/${java}`)
    await screen.findByRole("heading", { level: 1, name: /HashMap/ })
    expect(screen.queryByRole("region", { name: "Lộ trình học" })).toBeNull()
    expect(screen.getByRole("heading", { level: 2, name: "1. Là gì" })).toBeInTheDocument()
  })

  it("lists the solving steps above the attempt form, and remembers closing them", async () => {
    const user = userEvent.setup()
    const pattern = notebookActions.addPattern("t_dsa", null, "Two Pointers")
    const problem = notebookActions.addProblem({
      url: "https://leetcode.com/problems/3sum/",
      title: "3Sum",
      patternIds: [pattern],
    })
    renderApp()
    await go(`#/problem/${problem}`)
    await screen.findByRole("heading", { level: 1, name: /3Sum/ })
    const steps = screen.getByRole("button", { name: "Các bước giải một bài" })
    expect(steps).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("n ≤ 20 → O(2ⁿ)")).toBeInTheDocument()
    expect(screen.getByText("Bí quá 20 phút")).toBeInTheDocument()

    await user.click(steps)
    expect(steps).toHaveAttribute("aria-expanded", "false")
    expect(storage.get(KEYS.solveStepsOpen)).toBe(false)
  })

  it("collects a link in the inbox and files it as a problem", async () => {
    const user = userEvent.setup()
    const pattern = notebookActions.addPattern("t_dsa", null, "Graphs")
    renderApp()
    await go("#/inbox")
    await screen.findByRole("heading", { level: 1, name: "Hộp thu" })
    const main = screen.getByRole("main")
    await user.type(
      within(main).getByRole("textbox", { name: "Link" }),
      "https://leetcode.com/problems/number-of-islands/"
    )
    await user.click(within(main).getByRole("button", { name: "Thêm vào hộp thu" }))
    expect(liveValues(saved().inbox)).toHaveLength(1)

    await user.click(await within(main).findByRole("button", { name: "Thành bài tập" }))
    await user.click(within(main).getByRole("checkbox", { name: "Graphs" }))
    await user.click(within(main).getByRole("button", { name: "Lưu" }))
    const doc = saved()
    expect(liveValues(doc.inbox)).toHaveLength(0)
    expect(liveValues(doc.problems)[0]?.patternIds).toEqual([pattern])
  })

  it("adds a whole phase of suggestions with one click", async () => {
    const user = userEvent.setup()
    renderApp()
    await go("#/topic/t_dsa")
    await screen.findByRole("heading", { level: 1 })
    const firstPhase = modulesOf(content, "t_dsa")[0]!.phases[0]!
    const phaseName = localize(firstPhase.name, "vi")
    await user.click(screen.getByRole("button", { name: (name) => name.startsWith(phaseName) }))
    await user.click(screen.getByRole("button", { name: /^Thêm cả giai đoạn/ }))
    const names = liveValues(saved().patterns).map((p) => p.name)
    expect(names).toHaveLength(firstPhase.items.length)
    expect(screen.getByRole("button", { name: /^Thêm tất cả/ })).toBeInTheDocument()
    // Sidebar rows are cut to fit: hovering shows the whole name, and what is inside
    const phaseRow = screen.getByRole("treeitem", { name: phaseName })
    expect(phaseRow).toHaveAttribute("title", `${phaseName} · ${names.length} pattern`)
    // A pattern row adds its level
    await user.click(phaseRow)
    const longest = [...names].sort((x, y) => y.length - x.length)[0]!
    expect(await screen.findByRole("treeitem", { name: longest })).toHaveAttribute(
      "title",
      `${longest} · Chưa học`
    )
  })

  it("adds a suggested pattern with its theory, and offers a cleared note again", async () => {
    const user = userEvent.setup()
    const entry = [...content.items.values()].find(
      (e) => e.item.notes?.recognition && e.item.notes.template
    )!
    const id = notebookActions.addSuggestedPattern(content, entry.item.id, "vi")!
    const sample = [localize(entry.item.notes!.recognition!, "vi")].flat()[0]!
    expect(saved().patterns[id]?.sections.recognition).toContain(sample)
    expect(saved().patterns[id]?.sections.template).toMatch(/^```java\n/)

    notebookActions.setSection(id, "recognition", "")
    notebookActions.setSection(id, "template", "- mine")
    renderApp()
    await go(`#/pattern/${id}`)
    await screen.findByRole("heading", { level: 1 })

    // Copy straight from the list
    await user.click(screen.getByRole("button", { name: "Chép Nhận diện vào ghi chú" }))
    const recognition = saved().patterns[id]?.sections.recognition ?? ""
    expect(recognition).toContain(sample)

    // Read first, then copy from the dialog: it goes below what is already there
    await user.click(screen.getByRole("button", { name: "Template code" }))
    const dialog = await screen.findByRole("dialog", { name: "Template code · gợi ý" })
    await user.click(within(dialog).getByRole("button", { name: "Chép vào" }))
    expect(saved().patterns[id]?.sections.template).toMatch(/^- mine\n\n```java\n/)
    expect(saved().patterns[id]?.sections.recognition).toBe(recognition)
  })

  it("switches the app to English from the settings", async () => {
    const user = userEvent.setup()
    renderApp()
    await go("#/settings")
    await user.click(await screen.findByRole("radio", { name: "EN" }))
    expect(await screen.findByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument()
    expect(storage.get(KEYS.lang)).toBe("en")
  })
})
