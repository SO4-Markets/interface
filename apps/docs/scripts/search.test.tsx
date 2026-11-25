import React from "react"
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { test, expect, afterEach, afterAll, beforeAll } from "bun:test"
import { cleanup, render, act, fireEvent, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { SearchDialog } from "../src/components/SearchDialog"

const server = setupServer(
  http.get("/pagefind/pagefind.json", ({ request }) => {
    const url = new URL(request.url)
    const q = url.searchParams.get("q")
    if (q === "perpetual") {
      return HttpResponse.json({
        results: [
          {
            url: "/concepts/perpetuals",
            title: "Perpetuals Overview",
            excerpt: "Understanding funding rates and perpetual futures contracts.",
          },
        ],
      })
    }
    return HttpResponse.json({ results: [] })
  }),
  http.get("/pagefind/pagefind.js", () => {
    return HttpResponse.text("console.log('pagefind script loaded');")
  }),
)

beforeAll(() => {
  GlobalRegistrator.register()
  server.listen({ onUnhandledRequest: "error" })
})

afterAll(() => {
  server.close()
  GlobalRegistrator.unregister()
})

afterEach(() => {
  server.resetHandlers()
  cleanup()
})

test("SearchDialog renders closed state when isOpen is false", () => {
  const { container } = render(<SearchDialog isOpen={false} onClose={() => {}} />)
  expect(container.querySelector("[data-search-dialog]")).toBeNull()
})

test("SearchDialog opens and handles search input with MSW response", async () => {
  let closed = false
  const { container, getByPlaceholderText } = render(
    <SearchDialog isOpen={true} onClose={() => { closed = true }} />,
  )

  const dialog = container.querySelector("[data-search-dialog]")
  expect(dialog).not.toBeNull()

  const input = getByPlaceholderText("Search documentation...")
  expect(input).not.toBeNull()

  await act(async () => {
    fireEvent.change(input, { target: { value: "perpetual" } })
  })

  await waitFor(() => {
    const resultLink = container.querySelector("a[href='/concepts/perpetuals']")
    expect(resultLink).not.toBeNull()
    expect(resultLink?.textContent).toContain("Perpetuals Overview")
  })
})

test("SearchDialog displays empty results state when query matches nothing", async () => {
  const { container, getByPlaceholderText } = render(
    <SearchDialog isOpen={true} onClose={() => {}} />,
  )

  const input = getByPlaceholderText("Search documentation...")

  await act(async () => {
    fireEvent.change(input, { target: { value: "nonexistent-query" } })
  })

  await waitFor(() => {
    expect(container.textContent).toContain('No results found for "nonexistent-query"')
  })
})

test("SearchDialog renders malicious excerpts as text and preserves highlights", async () => {
  const malicious = '<script>alert("xss")</script> <img src=x onerror=alert(1)> <mark>safe match</mark>'
  const { container, getByPlaceholderText } = render(
    <SearchDialog
      isOpen={true}
      onClose={() => {}}
      onSearch={async () => [{ url: "/unsafe", title: "Unsafe", excerpt: malicious }]}
    />,
  )

  fireEvent.change(getByPlaceholderText("Search documentation..."), { target: { value: "unsafe" } })

  await waitFor(() => expect(container.querySelector("a[href='/unsafe']")).not.toBeNull())
  expect(container.querySelector("script")).toBeNull()
  expect(container.querySelector("img")).toBeNull()
  expect(container.querySelector("mark")?.textContent).toBe("safe match")
  expect(container.querySelector("[href='/unsafe']")?.textContent).toContain("<script>")
})
