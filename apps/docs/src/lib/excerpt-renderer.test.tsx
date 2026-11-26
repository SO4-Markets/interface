import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { getExcerptText, renderExcerpt } from "./excerpt-renderer"

describe("getExcerptText", () => {
  it("removes highlight tags and decodes entities in search excerpts", () => {
    expect(getExcerptText("A &amp; <mark>B &lt; C</mark> &quot;D&quot;"))
      .toBe('A & B < C "D"')
  })
})

describe("renderExcerpt", () => {
  it("renders malicious HTML as text and keeps only the mark highlight", () => {
    const { container } = render(
      <div>
        {renderExcerpt(
          '<mark>safe</mark><script>alert(1)</script><img src=x onerror=alert(1)><a href="https://evil.test">click</a><form action="/steal"><input></form>',
        )}
      </div>,
    )

    expect(container.querySelectorAll("script, img, a, form, input")).toHaveLength(0)
    expect(container.querySelectorAll("mark")).toHaveLength(1)
    expect(container.querySelector("mark")?.textContent).toBe("safe")
    expect(container.textContent).toContain("<script>alert(1)</script>")
    expect(container.textContent).toContain('<a href="https://evil.test">click</a>')
  })

  it("renders normal highlights and decoded entities", () => {
    const { container } = render(
      <div>{renderExcerpt("A &amp; <mark>B &lt; C</mark> &quot;D&quot;")}</div>,
    )

    expect(container.querySelectorAll("mark")).toHaveLength(1)
    expect(container.querySelector("mark")?.textContent).toBe("B < C")
    expect(container.textContent).toBe('A & B < C "D"')
  })
})
