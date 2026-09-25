import { describe, expect, it } from "vitest"
import {
  clearPrivateAccountQueries,
  createQueryClient,
  getQueryClient,
} from "./QueryProvider"
import { queryKeys } from "@/shared/lib/query-keys"

describe("QueryProvider client lifecycle", () => {
  it("creates isolated clients for separate server requests", () => {
    const first = createQueryClient()
    const second = createQueryClient()
    const privateKey = queryKeys.trade.positions("testnet", "GACCOUNT")

    first.setQueryData(privateKey, [{ id: "private" }])

    expect(first).not.toBe(second)
    expect(first.getQueryData(privateKey)).toEqual([{ id: "private" }])
    expect(second.getQueryData(privateKey)).toBeUndefined()
  })

  it("keeps one stable browser client", () => {
    expect(getQueryClient()).toBe(getQueryClient())
  })

  it("removes only the old account while retaining public and other-account data", async () => {
    const client = createQueryClient()
    const oldAccount = "GOLD"
    const newAccount = "GNEW"
    const oldPrivate = queryKeys.trade.positions("testnet", oldAccount)
    const newPrivate = queryKeys.trade.positions("testnet", newAccount)
    const publicMarket = queryKeys.trade.markets("testnet")

    client.setQueryData(oldPrivate, ["old"])
    client.setQueryData(newPrivate, ["new"])
    client.setQueryData(publicMarket, ["public"])

    await clearPrivateAccountQueries(client, oldAccount, "testnet")

    expect(client.getQueryData(oldPrivate)).toBeUndefined()
    expect(client.getQueryData(newPrivate)).toEqual(["new"])
    expect(client.getQueryData(publicMarket)).toEqual(["public"])
  })

  it("does not let a cancelled old-account request repopulate the cleared cache", async () => {
    const client = createQueryClient()
    const oldAccount = "GOLD"
    const key = queryKeys.trade.positions("testnet", oldAccount)
    let resolve!: (value: Array<string>) => void

    const pending = client.fetchQuery({
      queryKey: key,
      queryFn: ({ signal }) =>
        new Promise<Array<string>>((done, reject) => {
          resolve = done
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          )
        }),
    })

    await clearPrivateAccountQueries(client, oldAccount, "testnet")
    resolve(["late-old-result"])
    await pending.catch(() => undefined)

    expect(client.getQueryData(key)).toBeUndefined()
  })
})
