import { http, HttpResponse } from "msw"

const rpcResult = {
  jsonrpc: "2.0",
  id: 1,
  result: {},
}

export const handlers = [
  http.post("https://soroban-testnet.stellar.org", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { id?: string | number }

    return HttpResponse.json({
      ...rpcResult,
      id: body.id ?? rpcResult.id,
    })
  }),
  http.get("https://horizon-testnet.stellar.org/:path*", () => HttpResponse.json({})),
]
