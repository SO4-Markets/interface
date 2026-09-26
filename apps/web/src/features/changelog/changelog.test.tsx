import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { HttpResponse, http } from "msw"
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router"
import { mockArchiveChangelog, mockRecentChangelog } from "../../../test/msw/data/changelog"
import { server } from "../../../test/msw/server"
import { ChangelogPage } from "./components/ChangelogPage"
import { validateChangelogSearch } from "./search"
import { resetArchiveCacheForTests } from "./archive"

function renderChangelog(path = "/changelog") {
  const rootRoute = createRootRoute()
  const changelogRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/changelog",
    component: ChangelogPage,
    validateSearch: validateChangelogSearch,
  })
  const history = createMemoryHistory({ initialEntries: [path] })
  const router = createRouter({ routeTree: rootRoute.addChildren([changelogRoute]), history })
  return render(<RouterProvider router={router} />)
}

afterEach(() => {
  resetArchiveCacheForTests()
  window.localStorage.clear()
  window.history.replaceState(null, "", "/")
})

describe("ChangelogPage - States", () => {
  it("renders skeleton while loading", async () => {
    server.use(
      http.get("*/changelog.json", async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
        return HttpResponse.json(mockRecentChangelog)
      })
    )

    renderChangelog()

    const status = await screen.findByRole("status")
    expect(status).toBeInTheDocument()
    expect(status).toHaveAttribute("aria-live", "polite")
  })

  it("renders error state on fetch failure", async () => {
    server.use(http.get("*/changelog.json", () => HttpResponse.error()))

    renderChangelog()

    await waitFor(() => {
      const alert = screen.getByRole("alert")
      expect(alert).toBeInTheDocument()
      expect(alert).toHaveTextContent("Failed to load changelog")
    })
  })

  it("shows retry button and refetches on click", async () => {
    let callCount = 0

    server.use(
      http.get("*/changelog.json", () => {
        callCount++
        if (callCount === 1) return HttpResponse.error()
        return HttpResponse.json(mockRecentChangelog)
      })
    )

    const user = userEvent.setup()
    renderChangelog()

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: /try again/i }))

    await waitFor(() => {
      expect(screen.getByText("0.4.0")).toBeInTheDocument()
    })
    expect(callCount).toBe(2)
  })

  it("renders empty state for zero releases", async () => {
    server.use(
      http.get("*/changelog.json", () => HttpResponse.json({ releases: [] }))
    )

    renderChangelog()

    await waitFor(() => {
      expect(screen.getByText("No releases yet")).toBeInTheDocument()
    })
  })

  it("handles malformed JSON gracefully", async () => {
    server.use(
      http.get("*/changelog.json", () => new HttpResponse("{ invalid", { status: 200 }))
    )

    renderChangelog()

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Failed to load changelog")
    })
  })

  it("validates changelog data structure", async () => {
    server.use(
      http.get("*/changelog.json", () => HttpResponse.json({ someOtherField: [] }))
    )

    renderChangelog()

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid changelog format")
    })
  })

  it("displays loaded content after successful fetch", async () => {
    renderChangelog()

    await waitFor(() => {
      expect(screen.getByText("0.4.0")).toBeInTheDocument()
      expect(
        screen.getByText(/Trigger orders on the trade panel/)
      ).toBeInTheDocument()
    })
  })

  it("skeleton has aria attributes for accessibility", async () => {
    server.use(
      http.get("*/changelog.json", async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
        return HttpResponse.json(mockRecentChangelog)
      })
    )

    renderChangelog()

    const status = await screen.findByRole("status")
    expect(status).toHaveAttribute("aria-live", "polite")
    expect(status).toHaveAttribute("aria-label")

    const srOnly = screen.getByText(/loading changelog/i)
    expect(srOnly).toHaveClass("sr-only")
  })
})

describe("ChangelogPage - Archive (DX-012)", () => {
  it("initial payload contains only the recent window", async () => {
    renderChangelog()

    await waitFor(() => {
      expect(screen.getByText("0.4.0")).toBeInTheDocument()
    })
    // Archived release is NOT rendered before the explicit control is used.
    expect(screen.queryByText("0.1.0")).not.toBeInTheDocument()
  })

  it("loads the archive once on demand and appends older releases", async () => {
    const user = userEvent.setup()
    renderChangelog()

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /load older releases/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: /load older releases/i }))

    await waitFor(() => {
      expect(screen.getByText("0.1.0")).toBeInTheDocument()
    })
    // Control disappears once everything is loaded.
    expect(
      screen.queryByRole("button", { name: /load older releases/i })
    ).not.toBeInTheDocument()
  })

  it("shows a loading state on the control while fetching", async () => {
    server.use(
      http.get("*/changelog.archive.json", async () => {
        await new Promise((resolve) => setTimeout(resolve, 80))
        return HttpResponse.json(mockArchiveChangelog)
      })
    )

    const user = userEvent.setup()
    renderChangelog()

    const button = await screen.findByRole("button", { name: /load older releases/i })
    await user.click(button)

    const loadingButton = await screen.findByRole("button", { name: /loading older releases/i })
    expect(loadingButton).toBeDisabled()
    expect(loadingButton).toHaveAttribute("aria-busy", "true")

    await waitFor(() => {
      expect(screen.getByText("0.1.0")).toBeInTheDocument()
    })
  })

  it("fetches the archive at most once per session across remounts", async () => {
    let archiveRequests = 0
    server.use(
      http.get("*/changelog.archive.json", () => {
        archiveRequests++
        return HttpResponse.json(mockArchiveChangelog)
      })
    )

    const user = userEvent.setup()
    const first = renderChangelog()
    await user.click(await screen.findByRole("button", { name: /load older releases/i }))
    await waitFor(() => expect(screen.getByText("0.1.0")).toBeInTheDocument())
    first.unmount()

    // Second mount reuses the session cache — clicking again must not
    // re-download the archive.
    renderChangelog()
    await user.click(
      await screen.findByRole("button", { name: /load older releases/i })
    )
    await waitFor(() => expect(screen.getByText("0.1.0")).toBeInTheDocument())
    expect(archiveRequests).toBe(1)
  })

  it("auto-loads the archive when a filter is active", async () => {
    let archiveRequests = 0
    server.use(
      http.get("*/changelog.archive.json", () => {
        archiveRequests++
        return HttpResponse.json(mockArchiveChangelog)
      })
    )

    renderChangelog("/changelog?type=fixed")

    await waitFor(() => {
      expect(screen.getByText("0.3.2")).toBeInTheDocument()
    })
    expect(archiveRequests).toBe(1)
  })

  it("auto-loads the archive when searching", async () => {
    let archiveRequests = 0
    server.use(
      http.get("*/changelog.archive.json", () => {
        archiveRequests++
        return HttpResponse.json(mockArchiveChangelog)
      })
    )

    renderChangelog("/changelog?q=first+public")

    await waitFor(() => {
      expect(screen.getByText("0.1.0")).toBeInTheDocument()
    })
    expect(archiveRequests).toBe(1)
  })

  it("resolves a deep link into the archived range on cold load", async () => {
    // jsdom does not implement scrollIntoView.
    Element.prototype.scrollIntoView = function () {}
    const scrollIntoView = vi
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(() => {})
    let archiveRequests = 0
    server.use(
      http.get("*/changelog.archive.json", () => {
        archiveRequests++
        return HttpResponse.json(mockArchiveChangelog)
      })
    )

    window.history.replaceState(null, "", "/changelog#v0-1-0")
    renderChangelog()

    await waitFor(() => {
      expect(screen.getByText("0.1.0")).toBeInTheDocument()
    })
    expect(archiveRequests).toBe(1)
    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled()
    })
    const target = document.getElementById("v0-1-0")
    expect(target).not.toBeNull()
    scrollIntoView.mockRestore()
  })

  it("shows an error with retry when the archive fails to load", async () => {
    server.use(http.get("*/changelog.archive.json", () => HttpResponse.error()))

    const user = userEvent.setup()
    renderChangelog()

    await user.click(await screen.findByRole("button", { name: /load older releases/i }))

    const alert = await screen.findByRole("alert")
    expect(alert).toBeInTheDocument()

    // Retry succeeds.
    server.use(
      http.get("*/changelog.archive.json", () => HttpResponse.json(mockArchiveChangelog))
    )
    await user.click(screen.getByRole("button", { name: /try again/i }))
    await waitFor(() => expect(screen.getByText("0.1.0")).toBeInTheDocument())
  })
})

describe("ChangelogPage - Filters (DX-010)", () => {
  it("hides internal and ci entries by default, even when searched", async () => {
    // Searching pulls the archive in automatically; the internal entry must
    // stay hidden without the explicit toggle.
    renderChangelog("/changelog?q=metrics")

    await waitFor(() => {
      expect(screen.getByText("No entries match your filters.")).toBeInTheDocument()
    })
  })

  it("shows internal entries behind the URL-backed toggle", async () => {
    renderChangelog("/changelog?q=metrics&showInternal=true")

    // q=metrics wraps its match in <mark>, so assert on document text.
    await screen.findByText("0.1.0")
    expect(document.body.textContent).toContain(
      "Internal performance metrics dashboard."
    )
  })

  it("releases with no matching entries are hidden entirely", async () => {
    renderChangelog("/changelog?type=security&showInternal=true")

    await waitFor(() => {
      expect(screen.getByText("No entries match your filters.")).toBeInTheDocument()
    })
    expect(screen.queryByText("0.4.0")).not.toBeInTheDocument()
  })
})

describe("validateChangelogSearch - invalid params fall back to defaults", () => {
  it("drops unknown values without throwing", () => {
    expect(
      validateChangelogSearch({
        type: "bogus",
        area: "narnia",
        q: 42,
        showInternal: "yes",
      })
    ).toEqual({})
  })

  it("keeps valid values", () => {
    expect(
      validateChangelogSearch({
        type: "fixed",
        area: "trade",
        q: "liquidation",
        showInternal: true,
      })
    ).toEqual({ type: "fixed", area: "trade", q: "liquidation", showInternal: true })
  })

  it("treats an empty query as absent", () => {
    expect(validateChangelogSearch({ q: "" })).toEqual({})
  })
})
