import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import "@/i18n"
import i18n from "@/i18n"
import { App } from "@/app"
import { ContentProvider } from "@/content/context"
import { buildContent, dataFiles } from "@/content/load"
import { localize } from "@/content/localize"
import { KEYS, storage } from "@/lib/storage"
import { emptyProgress } from "@/progress/logic"
import { progressActions } from "@/progress/store"
import { uiActions, useUiStore } from "@/state/ui"

const content = buildContent(dataFiles)
const firstPhase = content.phases[0]!
const firstItem = firstPhase.items[0]!
const itemTitle = localize(firstItem.title, "vi").replace(/`|\*\*/g, "")

function renderApp() {
  return render(
    <ContentProvider content={content}>
      <App />
    </ContentProvider>
  )
}

beforeEach(async () => {
  await i18n.changeLanguage("vi")
  progressActions.init(emptyProgress())
  useUiStore.setState({ filter: "all", openId: null })
  uiActions.setExpanded([firstPhase.id])
})

describe("App", () => {
  it("shows the roadmap title and the first phase open", () => {
    renderApp()
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      localize(content.title, "vi")
    )
    expect(screen.getByText(itemTitle)).toBeInTheDocument()
  })

  it("ticking an item saves progress and updates the stats", async () => {
    const user = userEvent.setup()
    renderApp()
    const [firstCheckbox] = screen.getAllByRole("checkbox", { name: "Đánh dấu đã xong" })
    await user.click(firstCheckbox!)

    const saved = storage.get(KEYS.progress) as { items: Record<string, { done?: boolean }> }
    expect(saved.items[firstItem.id]?.done).toBe(true)
    expect(screen.getAllByText(`1/${content.items.size} mục`).length).toBeGreaterThan(0)
  })

  it("opens an item, switches tabs and saves notes as you type", async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByText(itemTitle))

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByRole("tab", { name: /Kiến thức/ })).toHaveAttribute(
      "aria-selected",
      "true"
    )

    await user.click(within(dialog).getByRole("tab", { name: /Ghi chú/ }))
    await user.type(within(dialog).getByPlaceholderText(/Ý tưởng chính/), "two pointers")

    const saved = storage.get(KEYS.progress) as { items: Record<string, { notes?: string }> }
    expect(saved.items[firstItem.id]?.notes).toBe("two pointers")
  })

  it("switches the interface language", async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole("radio", { name: "EN" }))
    expect(screen.getByRole("button", { name: "Export progress" })).toBeInTheDocument()
    expect(storage.get(KEYS.lang)).toBe("en")
  })

  it("collapses and expands every phase", async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole("button", { name: "Mở hết" }))
    expect(useUiStore.getState().expanded).toHaveLength(content.phases.length)
    await user.click(screen.getByRole("button", { name: "Thu gọn" }))
    expect(screen.queryByText(itemTitle)).not.toBeInTheDocument()
  })
})

describe("item dialog", () => {
  it("opens on the Learn tab every time, even for the same item", async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByText(itemTitle))
    let dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("tab", { name: /Ghi chú/ }))
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

    await user.click(screen.getByText(itemTitle))
    dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByRole("tab", { name: /Kiến thức/ })).toHaveAttribute(
      "aria-selected",
      "true"
    )
  })
})

describe("keyboard focus", () => {
  it("returns focus to the item row after the dialog closes", async () => {
    const user = userEvent.setup()
    renderApp()
    const opener = screen.getByText(itemTitle).closest("button")!
    await user.click(opener)
    await screen.findByRole("dialog")
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(document.activeElement).toBe(opener)
  })
})
