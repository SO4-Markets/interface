import { describe, expect, it } from "vitest"
import { PYTH_FEED_IDS } from "./pyth-feed-ids"
import { normalizePythQuery } from "./pyth-proxy-query"

const BTC = PYTH_FEED_IDS.BTC
const ETH = PYTH_FEED_IDS.ETH

describe("normalizePythQuery", () => {
  it("accepts the app's own request and canonicalises it", () => {
    const a = normalizePythQuery(`?ids[]=${ETH}&ids[]=${BTC}&encoding=hex&parsed=true&ignore_invalid_price_ids=true`)
    const b = normalizePythQuery(`?parsed=true&ids[]=${BTC.toUpperCase().replace("0X", "0x")}&ids[]=${ETH}&encoding=hex&ignore_invalid_price_ids=true&ids[]=${BTC}`)
    expect(a).not.toBeNull()
    expect(a).toBe(b)
  })

  it("rejects feed IDs outside the app's allowlist", () => {
    expect(normalizePythQuery(`?ids[]=0x${"a".repeat(64)}`)).toBeNull()
  })

  it("rejects unknown parameters and unexpected option values", () => {
    expect(normalizePythQuery(`?ids[]=${BTC}&benchmarks_only=true`)).toBeNull()
    expect(normalizePythQuery(`?ids[]=${BTC}&encoding=base64`)).toBeNull()
  })

  it("rejects requests with no feed IDs", () => {
    expect(normalizePythQuery("?encoding=hex")).toBeNull()
  })
})
