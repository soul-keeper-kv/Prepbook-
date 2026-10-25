import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { InlineText, Paragraphs, plainText } from "@/components/inline-text"

describe("InlineText", () => {
  it("renders `code` and **bold**, and leaves other characters alone", () => {
    const { container } = render(<InlineText text="Use `map` for **O(1)** lookups, a * b < c" />)
    expect(container.querySelector("code")?.textContent).toBe("map")
    expect(container.querySelector("strong")?.textContent).toBe("O(1)")
    expect(container.textContent).toBe("Use map for O(1) lookups, a * b < c")
  })

  it("does not interpret HTML", () => {
    const { container } = render(<InlineText text="<img src=x onerror=alert(1)>" />)
    expect(container.querySelector("img")).toBeNull()
  })
})

describe("Paragraphs", () => {
  it("splits on blank lines and keeps single line breaks", () => {
    const { container } = render(<Paragraphs text={"one\ntwo\n\nthree"} />)
    expect(container.querySelectorAll("p")).toHaveLength(2)
    expect(container.querySelectorAll("br")).toHaveLength(1)
  })
})

it("plainText strips the markup", () => {
  expect(plainText("`a` and **b**")).toBe("a and b")
})
