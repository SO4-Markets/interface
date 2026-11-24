import { describe, expect, it, vi } from "vitest"
import { TRADER_FAQS } from "@/features/referrals/data/faqs"
import { ORGANIZATION_NAME, SITE_URL } from "@/shared/lib/site-identity"

// The route modules pull in their page components; only `head()` is under
// test here, so stub the wallet-kit-backed navigation they render.
vi.mock("@/ui/Navbar", () => ({ Navbar: () => null }))
vi.mock("@/features/wallet/components/ConnectButton", () => ({ ConnectButton: () => null }))
vi.mock("@/features/wallet/components/NetworkMismatchBanner", () => ({
  NetworkMismatchBanner: () => null,
}))

type HeadScripts = { scripts?: Array<{ type?: string; children?: string }> }

/** Parses every ld+json script a route's `head()` declares. */
function ldJson(head: unknown): Array<Record<string, unknown>> {
  const result = (head as () => HeadScripts)()
  return (result.scripts ?? [])
    .filter((script) => script.type === "application/ld+json")
    .map((script) => JSON.parse(script.children ?? "{}") as Record<string, unknown>)
}

describe("per-page structured data (issue 954)", () => {
  it("publishes Organization (and the app it publishes) on /", async () => {
    const { Route } = await import("./index")
    const docs = ldJson(Route.options.head)
    expect(docs.map((doc) => doc["@type"])).toEqual(["Organization", "WebApplication"])
    expect(docs[0]).toMatchObject({ name: ORGANIZATION_NAME, url: SITE_URL })
  })

  it("publishes a FAQPage on /referrals that mirrors the visible FAQ", async () => {
    const { Route } = await import("./referrals")
    const [faq] = ldJson(Route.options.head)
    expect(faq["@type"]).toBe("FAQPage")
    expect(faq.url).toBe(`${SITE_URL}/referrals`)
    const entries = faq.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>
    expect(entries.map((entry) => entry.name)).toEqual(TRADER_FAQS.map((item) => item.q))
    expect(entries.map((entry) => entry.acceptedAnswer.text)).toEqual(
      TRADER_FAQS.map((item) => item.a),
    )
  })
})
