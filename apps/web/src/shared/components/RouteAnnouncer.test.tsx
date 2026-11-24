import { describe, expect, it } from "vitest"
import { act, render, screen, waitFor } from "@testing-library/react"
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router"
import { AppShell } from "@workspace/ui/components/app-shell"

import { RouteAnnouncer } from "./RouteAnnouncer"

function Page({ title }: { title: string }) {
  return (
    <AppShell navbar={<nav aria-label="Main" />}>
      <h1>{title}</h1>
      <button type="button">Filter</button>
    </AppShell>
  )
}

function renderApp() {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <RouteAnnouncer />
        <Outlet />
      </>
    ),
  })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <Page title="Home" />,
  })
  const poolsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/pools",
    validateSearch: (search: Record<string, unknown>) => ({
      tab: typeof search.tab === "string" ? search.tab : undefined,
    }),
    component: () => <Page title="Pools" />,
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, poolsRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  })

  const view = render(<RouterProvider router={router} />)
  return { router, view }
}

/** Live-region text with the re-announcement marker stripped. */
function announcement() {
  return document
    .querySelector("[data-slot='live-region']")
    ?.textContent.replace(/\u200B/g, "")
}

describe("RouteAnnouncer", () => {
  it("mounts an empty polite live region", async () => {
    renderApp()
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument())

    const region = document.querySelector("[data-slot='live-region']")
    expect(region).toHaveAttribute("aria-live", "polite")
    expect(announcement()).toBe("")
  })

  it("does not steal focus on the initial page load", async () => {
    renderApp()
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument())

    expect(document.body).toHaveFocus()
  })

  it("announces the new page title after navigation", async () => {
    const { router } = renderApp()
    await waitFor(() => expect(screen.getByText("Home")).toBeInTheDocument())

    await act(async () => {
      await router.navigate({ to: "/pools" })
    })

    await waitFor(() => expect(announcement()).toBe("Pools"))
  })

  it("moves focus to the new page heading after navigation", async () => {
    const { router } = renderApp()
    await waitFor(() => expect(screen.getByText("Home")).toBeInTheDocument())

    await act(async () => {
      await router.navigate({ to: "/pools" })
    })

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1, name: "Pools" })).toHaveFocus()
    )
    expect(screen.getByRole("heading", { level: 1 })).toHaveAttribute(
      "tabindex",
      "-1"
    )
  })

  it("leaves focus alone on query-only changes", async () => {
    const { router } = renderApp()
    await act(async () => {
      await router.navigate({ to: "/pools" })
    })
    await waitFor(() => expect(announcement()).toBe("Pools"))

    const filter = screen.getByRole("button", { name: "Filter" })
    act(() => filter.focus())

    await act(async () => {
      await router.navigate({ to: "/pools", search: { sort: "tvl.desc" } })
    })

    // Same pathname: the sort/filter state changed, not the page.
    expect(filter).toHaveFocus()
    expect(announcement()).toBe("Pools")
  })

  it("announces every pathname change", async () => {
    const { router } = renderApp()

    await act(async () => {
      await router.navigate({ to: "/pools" })
    })
    await waitFor(() => expect(announcement()).toBe("Pools"))

    await act(async () => {
      await router.navigate({ to: "/" })
    })
    await waitFor(() => expect(announcement()).toBe("Home"))

    await act(async () => {
      await router.navigate({ to: "/pools" })
    })
    await waitFor(() => expect(announcement()).toBe("Pools"))
  })
})
