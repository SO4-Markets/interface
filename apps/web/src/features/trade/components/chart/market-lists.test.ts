import { expect, it } from "vitest"
import { readMarketLists, saveMarketLists } from "./market-lists"

it("migrates legacy recent markets and network favorites without duplicates", () => {
  localStorage.setItem("so4-recent-markets-v1", '["btc","btc",2,"eth"]')
  localStorage.setItem("so4-market-favorites-v1:test", '{"markets":["eth"]}')
  expect(readMarketLists("test")).toEqual({ recent: ["btc", "eth"], watchlist: ["eth"] })
  saveMarketLists("test", { recent: [], watchlist: [] })
  expect(readMarketLists("test")).toEqual({ recent: [], watchlist: [] })
  localStorage.clear()
})
