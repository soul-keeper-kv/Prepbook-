import { render } from "@testing-library/react"
import { expect, it } from "vitest"
import { Markdown } from "@/components/common/markdown"

it("renders `code` inside **bold**", () => {
  const { container } = render(<Markdown text="**dời `R` sang trái**" />)
  expect(container.querySelector("strong code")?.textContent).toBe("R")
  expect(container.textContent).toBe("dời R sang trái")
})

it("renders a | table |, with inline Markdown in its cells", () => {
  const text = [
    "| Dấu hiệu | Dạng |",
    "| --- | --- |",
    "| Mảng **đã sort**, tìm cặp | Hai đầu |",
    "| Linked list có vòng | `fast` & `slow` |",
  ].join("\n")
  const { container } = render(<Markdown text={text} />)
  expect([...container.querySelectorAll("th")].map((th) => th.textContent)).toEqual([
    "Dấu hiệu",
    "Dạng",
  ])
  expect(container.querySelectorAll("tbody tr")).toHaveLength(2)
  expect(container.querySelector("td strong")?.textContent).toBe("đã sort")
  expect(container.querySelectorAll("td code")).toHaveLength(2)
})

it("renders a ## heading as a heading", () => {
  const { container } = render(<Markdown text={"## Là gì?\n\nMột đoạn."} />)
  expect(container.querySelector("h3")?.textContent).toBe("Là gì?")
})
