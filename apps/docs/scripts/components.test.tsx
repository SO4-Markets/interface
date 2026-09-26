import React from "react"
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { test, expect, afterEach, afterAll, beforeAll } from "bun:test"
import {
  cleanup,
  render,
  act,
  fireEvent,
  waitFor,
} from "@testing-library/react"
import { components } from "../src/mdx/components"
import { Sidebar } from "../src/components/Sidebar"
import { Toc } from "../src/components/Toc"
import { Pager } from "../src/components/Pager"
import * as jsxRuntime from "react/jsx-runtime"
import { compile, run } from "@mdx-js/mdx"
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { shikiPlugin } from "../src/lib/rehype-shiki"
import remarkGfm from "remark-gfm"
import { DocsLayout } from "../src/components/DocsLayout"
import { Tab, Tabs as DocsTabs } from "../src/mdx/Tabs"

beforeAll(() => {
  GlobalRegistrator.register()
})

afterAll(() => {
  GlobalRegistrator.unregister()
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

const mdxFixture = `
# Heading 1

## Heading 2

This is a paragraph with some \`inline code\`.

> This is a blockquote.

| Column 1 | Column 2 |
| -------- | -------- |
| Value 1  | Value 2  |

Here is an [internal link](/foo) and an [external link](https://example.com).

- Item 1
- Item 2

---

![Alt text](/image.png)
`

test("MDX components map renders kitchen-sink fixture correctly", async () => {
  const compiled = await compile(mdxFixture, {
    outputFormat: "function-body",
    remarkPlugins: [remarkGfm],
    rehypePlugins: [shikiPlugin],
  })

  const { default: MDXContent } = await run(String(compiled), {
    ...jsxRuntime,
  })

  const rootRoute = createRootRoute({
    component: () => <MDXContent components={components} />,
  })

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory(),
  })

  let container: HTMLElement
  await act(async () => {
    const result = render(<RouterProvider router={router} />)
    container = result.container
  })

  const h1 = container!.querySelector("h1")
  expect(h1).not.toBeNull()

  const callout = container.querySelector("[role='status']")
  expect(callout).not.toBeNull()

  const codes = Array.from(container.querySelectorAll("code"))
  const inlineCode = codes.find((c) => c.textContent === "inline code")
  expect(inlineCode).not.toBeUndefined()

  const internalLink = container.querySelector("a[href='/foo']")
  expect(internalLink).not.toBeNull()

  const externalLink = container.querySelector("a[href='https://example.com']")
  expect(externalLink).not.toBeNull()
})

test("Sidebar renders section headers and links correctly", () => {
  const sections = [
    {
      label: "Overview",
      pages: [
        { route: "/get-started/introduction", title: "Introduction" },
        { route: "/get-started/quickstart", title: "Quickstart", status: "beta" as const },
      ],
    },
  ]

  const rootRoute = createRootRoute({
    component: () => <Sidebar sections={sections} currentRoute="/get-started/introduction" />,
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory(),
  })

  let container: HTMLElement
  render(<RouterProvider router={router} />)

  const activeLink = document.querySelector("a[aria-current='page']")
  expect(activeLink).not.toBeNull()
  expect(activeLink?.textContent).toContain("Introduction")
})

test("Toc renders table of contents anchors", () => {
  const entries = [
    { title: "Overview", id: "overview", level: 2 },
    { title: "Architecture", id: "architecture", level: 3 },
  ]
  const { container } = render(<Toc entries={entries} activeId="architecture" />)

  const activeAnchor = container.querySelector("a[aria-current='location']")
  expect(activeAnchor).not.toBeNull()
  expect(activeAnchor?.textContent).toBe("Architecture")
})

test("Pager renders previous and next navigation buttons", () => {
  const prev = { title: "Introduction", route: "/get-started/introduction" }
  const next = { title: "Wallets", route: "/get-started/wallets" }

  const rootRoute = createRootRoute({
    component: () => <Pager prev={prev} next={next} />,
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory(),
  })

  render(<RouterProvider router={router} />)

  const prevLink = document.querySelector("a[rel='prev']")
  const nextLink = document.querySelector("a[rel='next']")

  expect(prevLink).not.toBeNull()
  expect(nextLink).not.toBeNull()
  expect(prevLink?.textContent).toContain("Introduction")
  expect(nextLink?.textContent).toContain("Wallets")
})

function SyncedTabs() {
  return (
    <>
      <DocsTabs groupId="manager">
        <Tab label="bun">Bun first</Tab>
        <Tab label="npm">npm first</Tab>
      </DocsTabs>
      <DocsTabs groupId="manager">
        <Tab label="bun">Bun second</Tab>
        <Tab label="npm">npm second</Tab>
      </DocsTabs>
    </>
  )
}

test("DocsLayout exposes landmarks and a working skip link", () => {
  const result = render(
    <DocsLayout
      header={<a href="/">SO4 docs</a>}
      sidebar={<nav aria-label="Documentation">Sidebar</nav>}
      toc={
        <ol>
          <li>
            <a href="#intro">Introduction</a>
          </li>
        </ol>
      }
      footer="Footer"
    >
      <h1 id="intro">Introduction</h1>
    </DocsLayout>
  )

  const main = result.getByRole("main")
  const skipLink = result.getByRole("link", { name: "Skip to main content" })
  expect(main.id).toBe("main-content")
  expect(main.getAttribute("tabindex")).toBe("-1")
  expect(result.getByRole("contentinfo")).toBeDefined()

  fireEvent.click(skipLink)
  expect(document.activeElement).toBe(main)
})

test("MDX tabs sync groups, persist selection, and keep every panel", async () => {
  const result = render(<SyncedTabs />)
  const npmTabs = result.getAllByRole("tab", { name: "npm" })
  fireEvent.click(npmTabs[0])

  await waitFor(() => {
    expect(npmTabs[0].getAttribute("aria-selected")).toBe("true")
    expect(npmTabs[1].getAttribute("aria-selected")).toBe("true")
  })
  expect(window.localStorage.getItem("so4-docs-tabs:manager")).toBe("npm")
  expect(result.getByText("npm first")).toBeDefined()
  expect(result.getByText("npm second")).toBeDefined()
})

test("MDX content tabs keep every panel mounted for print and search", () => {
  const result = render(
    <components.Tabs>
      <components.TabItem label="bun">Bun instructions</components.TabItem>
      <components.TabItem label="npm">npm instructions</components.TabItem>
    </components.Tabs>
  )

  const panels = [...result.container.querySelectorAll("[data-tab-panel]")]
  expect(panels.length).toBe(2)
  expect(panels.map((panel) => panel.getAttribute("data-tab-label"))).toEqual([
    "bun",
    "npm",
  ])
  expect(panels[0].hidden).toBe(false)
  expect(panels[1].hidden).toBe(true)

  // Only the `hidden` attribute separates the panels, so the print stylesheet
  // can expand all of them without a beforeprint JS hook.
  fireEvent.click(result.getByRole("button", { name: "npm" }))
  expect(panels[0].hidden).toBe(true)
  expect(panels[1].hidden).toBe(false)
})

test("MDX tabs restore a persisted selection", async () => {
  window.localStorage.setItem("so4-docs-tabs:manager", "npm")
  const result = render(<SyncedTabs />)

  await waitFor(() => {
    for (const tab of result.getAllByRole("tab", { name: "npm" })) {
      expect(tab.getAttribute("aria-selected")).toBe("true")
    }
  })
})

test("MDX tabs fall back to the first option when storage is unavailable", async () => {
  const storage = window.localStorage
  const originalGetItem = storage.getItem.bind(storage)
  Object.defineProperty(storage, "getItem", {
    configurable: true,
    value: () => {
      throw new Error("storage disabled")
    },
  })

  try {
    const result = render(<SyncedTabs />)
    await waitFor(() => {
      for (const tab of result.getAllByRole("tab", { name: "bun" })) {
        expect(tab.getAttribute("aria-selected")).toBe("true")
      }
    })
  } finally {
    Object.defineProperty(storage, "getItem", {
      configurable: true,
      value: originalGetItem,
    })
  }
})
