import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HttpResponse, http } from "msw";
import { server } from "../../test/msw/server";
import { FaucetPage } from "../features/faucet/components/faucet-page";
import { TradePage } from "../features/trade/components/TradePage";
import { ReferralsPage } from "../features/referrals/components/referrals-page";
import { ChangelogPage } from "../features/changelog/components/ChangelogPage";

// A11y Triage Guide:
// If an accessibility violation occurs, you can triage it by inspecting the violation details.
// If the issue is a known upstream component library problem or inherently unfixable at the moment,
// you can waive it by filtering out specific rules or adding `rules: { 'rule-name': { enabled: false } }`
// into the axe run config.
// Always aim to fix critical and serious violations rather than waiving them.

function renderWithRouter(component: React.FunctionComponent) {
  const rootRoute = createRootRoute()
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component,
  })
  const routeTree = rootRoute.addChildren([indexRoute])
  const history = createMemoryHistory({ initialEntries: ["/"] })
  const router = createRouter({ routeTree, history })

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

describe("Accessibility Smoke Checks", () => {
  it("Faucet page has no critical/serious violations in disconnected state", async () => {
    const { container } = renderWithRouter(FaucetPage)
    const results = await axe(container)

    const seriousViolations = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    )
    expect(seriousViolations).toEqual([])
  })

  it("Trade page has no critical/serious violations in disconnected state", async () => {
    const { container } = renderWithRouter(TradePage)
    const results = await axe(container)

    const seriousViolations = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    )
    expect(seriousViolations).toEqual([])
  })

  it("Referrals page has no critical/serious violations in disconnected state", async () => {
    const { container } = renderWithRouter(ReferralsPage)
    const results = await axe(container)

    const seriousViolations = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    )
    expect(seriousViolations).toEqual([])
  })

  describe("Changelog accessibility", () => {
    it("has no critical/serious violations in default state (loaded)", async () => {
      const { container } = renderWithRouter(ChangelogPage)
      // Wait for loading
      await new Promise((resolve) => setTimeout(resolve, 100))
      const results = await axe(container)

      const seriousViolations = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      )
      expect(seriousViolations).toEqual([])
    })

    it("has no critical/serious violations in error state", async () => {
      server.use(http.get("/changelog.json", () => HttpResponse.error()))

      const { container } = renderWithRouter(ChangelogPage)
      await new Promise((resolve) => setTimeout(resolve, 100))
      const results = await axe(container)

      const seriousViolations = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      )
      expect(seriousViolations).toEqual([])
    })

    it("has no critical/serious violations in empty state", async () => {
      server.use(
        http.get("/changelog.json", () => HttpResponse.json({ releases: [] }))
      )

      const { container } = renderWithRouter(ChangelogPage)
      await new Promise((resolve) => setTimeout(resolve, 100))
      const results = await axe(container)

      const seriousViolations = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      )
      expect(seriousViolations).toEqual([])
    })
  })
})
