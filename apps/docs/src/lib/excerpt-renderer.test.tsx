import { describe, expect, it } from "vitest"
import { getExcerptText } from "./excerpt-renderer"

describe("getExcerptText", () => {
  it("removes highlight tags and decodes entities in search excerpts", () => {
    expect(getExcerptText("A &amp; <mark>B &lt; C</mark> &quot;D&quot;"))
      .toBe('A & B < C "D"')
  })
})
