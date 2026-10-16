import { describe, expect, it, vi } from "vitest"
import { getRouter } from "./router"

vi.mock("./routeTree.gen", () => ({
  routeTree: {},
}))

describe("getRouter", () => {
  it("enables defaultViewTransition for smooth route transitions", () => {
    const router = getRouter()
    expect(router.options.defaultViewTransition).toBe(true)
  })

  it("enables scrollRestoration", () => {
    const router = getRouter()
    expect(router.options.scrollRestoration).toBe(true)
  })
})
