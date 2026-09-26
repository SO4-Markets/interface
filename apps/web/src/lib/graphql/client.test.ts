import { afterEach, describe, expect, it, vi } from "vitest"
import { HttpResponse, delay, http } from "msw"
import { server } from "../../../test/msw/server"
import { executeGraphQLQuery } from "./client"
import { GET_MARKETS } from "./queries"

vi.mock("@/app/config/indexer", () => ({
  INDEXER_CONFIG: {
    enabled: true,
    graphqlUrl: "https://indexer.test/graphql",
    network: "testnet",
  },
}))

const INDEXER_URL = "https://indexer.test/graphql"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("executeGraphQLQuery cancellation", () => {
  it("forwards TanStack's AbortSignal to fetch and aborts obsolete work", async () => {
    let requestStarted = false

    server.use(
      http.post(INDEXER_URL, async ({ request }) => {
        requestStarted = true
        expect(request.signal.aborted).toBe(false)
        await delay(5_000)
        return HttpResponse.json({
          data: { markets: { nodes: [] } },
        })
      }),
    )

    const controller = new AbortController()
    const pending = executeGraphQLQuery(
      GET_MARKETS,
      {},
      { signal: controller.signal },
    )

    await vi.waitFor(() => expect(requestStarted).toBe(true))
    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: "AbortError" })
  })
})
