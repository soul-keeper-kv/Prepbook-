import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import "@/i18n"
import i18n from "@/i18n"
import { App } from "@/app"
import { ContentProvider } from "@/content/context"
import { buildContent, dataFiles } from "@/content/load"
import { localize } from "@/content/localize"
import { KEYS, storage } from "@/lib/storage"
import { liveValues } from "@/notebook/logic"
import { withDefaultTopics } from "@/notebook/migrate"
import { emptyNotebook, type Notebook } from "@/notebook/schema"
import { notebookActions } from "@/notebook/store"

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
    await user.click(screen.getByRole("radio", { name: /Cần gợi ý/ }))
    await user.type(screen.getByRole("spinbutton", { name: "Số phút" }), "35")
    await user.click(screen.getByRole("button", { name: "Lưu lần làm" }))
    const attempts = liveValues(saved().attempts)
    expect(attempts).toHaveLength(1)
    expect(attempts[0]).toMatchObject({ outcome: "hint", minutes: 35 })
    expect(screen.getByText("Làm lại: sau 3 ngày")).toBeInTheDocument()
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
    const firstPhase = content.phases[0]!
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

  it("switches the app to English from the settings", async () => {
    const user = userEvent.setup()
    renderApp()
    await go("#/settings")
    await user.click(await screen.findByRole("radio", { name: "EN" }))
    expect(await screen.findByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument()
    expect(storage.get(KEYS.lang)).toBe("en")
  })
})
