import { describe, expect, it, vi, afterEach } from "vitest"
import { HttpResponse, http } from "msw"
import { server } from "../../../../test/msw/server"
import {
  fetchOracleCandles,
  fetchPythBenchmarkCandles,
  fetchTokenPrices,
  validateAndSortCandles,
} from "./oracle"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSo4Ticker(symbol: string, min = 80_000, max = 80_050) {
  return { token: `addr_${symbol}`, symbol, min, max, timestamp: Math.floor(Date.now() / 1000) }
}

function makeBinanceTicker(symbol: string, bid: string, ask: string) {
  return { symbol, bidPrice: bid, askPrice: ask }
}

function makeGmxTicker(symbol: string, min: string, max: string) {
  return { tokenSymbol: symbol, tokenAddress: `addr_${symbol}`, minPrice: min, maxPrice: max, updatedAt: Date.now() }
}

// ---------------------------------------------------------------------------
// fetchTokenPrices — fallback chain
// ---------------------------------------------------------------------------

describe("fetchTokenPrices fallback chain", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns SO4 oracle prices when the primary source succeeds", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        makeSo4Ticker("TWBTC", 80_000e30, 80_050e30),
        makeSo4Ticker("TETH", 2_300e30, 2_302e30),
        makeSo4Ticker("TXLM", 0.167e30, 0.1672e30),
        makeSo4Ticker("TUSDC", 0.9998e30, 1.0002e30),
      ],
    }))

    const prices = await fetchTokenPrices()

    expect(prices.length).toBeGreaterThan(0)
    expect(prices.some((p) => p.source === "so4")).toBe(true)
    expect(prices.every((p) => p.source !== "fallback")).toBe(true)
  })

  it("falls through to Pyth when SO4 oracle fails", async () => {
    let callCount = 0
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      callCount++
      // SO4 oracle fails
      if (typeof url === "string" && url.includes("biscotti-proxy")) {
        return Promise.reject(new Error("SO4 down"))
      }
      // Pyth Hermes succeeds
      if (typeof url === "string" && url.includes("hermes.pyth")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            parsed: [
              { id: "btc_id", price: { price: "8000000", expo: -2, publish_time: Math.floor(Date.now() / 1000) }, ema_price: { price: "8000000", expo: -2 } },
            ],
          }),
        })
      }
      // Binance succeeds (for display prices)
      return Promise.resolve({
        ok: true,
        json: async () => [
          makeBinanceTicker("BTCUSDT", "79990", "80010"),
          makeBinanceTicker("ETHUSDT", "2299", "2301"),
          makeBinanceTicker("XLMUSDT", "0.166", "0.168"),
          makeBinanceTicker("USDCUSDT", "0.9997", "1.0003"),
        ],
      })
    }))

    const prices = await fetchTokenPrices()
    // Should not use SO4 source since it failed
    expect(prices.every((p) => p.source !== "so4")).toBe(true)
  })

  it("falls through to Binance when SO4 and Pyth both fail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("biscotti-proxy")) {
        return Promise.reject(new Error("SO4 down"))
      }
      if (typeof url === "string" && url.includes("hermes.pyth")) {
        return Promise.reject(new Error("Pyth down"))
      }
      // Binance succeeds
      return Promise.resolve({
        ok: true,
        json: async () => [
          makeBinanceTicker("BTCUSDT", "79990", "80010"),
          makeBinanceTicker("ETHUSDT", "2299", "2301"),
          makeBinanceTicker("XLMUSDT", "0.166", "0.168"),
          makeBinanceTicker("USDCUSDT", "0.9997", "1.0003"),
        ],
      })
    }))

    const prices = await fetchTokenPrices()
    expect(prices.some((p) => p.source === "binance")).toBe(true)
    expect(prices.every((p) => p.source !== "so4")).toBe(true)
    expect(prices.every((p) => p.source !== "pyth")).toBe(true)
  })

  it("falls through to GMX oracle when SO4, Pyth, and Binance all fail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("biscotti-proxy")) {
        return Promise.reject(new Error("SO4 down"))
      }
      if (typeof url === "string" && url.includes("hermes.pyth")) {
        return Promise.reject(new Error("Pyth down"))
      }
      if (typeof url === "string" && url.includes("binance.com")) {
        return Promise.reject(new Error("Binance down"))
      }
      // GMX oracle succeeds
      return Promise.resolve({
        ok: true,
        json: async () => [
          makeGmxTicker("BTC", "80000000000000000000000000000000000", "80050000000000000000000000000000000"),
          makeGmxTicker("ETH", "2300000000000000000000000000000000", "2302000000000000000000000000000000"),
        ],
      })
    }))

    const prices = await fetchTokenPrices()
    expect(prices.some((p) => p.source === "gmx")).toBe(true)
  })

  it("returns dummy fallback prices when all sources fail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("All sources down")))

    const prices = await fetchTokenPrices()

    expect(prices.length).toBeGreaterThan(0)
    expect(prices.every((p) => p.source === "fallback")).toBe(true)
    // Dummy prices are reasonable values
    const btc = prices.find((p) => p.symbol === "BTC")
    expect(btc).toBeDefined()
    expect(btc!.minPrice).toBeGreaterThan(0)
  })

  it("falls back to dummy when SO4 returns an empty array", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("biscotti-proxy")) {
        // Empty response — no tickers
        return Promise.resolve({ ok: true, json: async () => [] })
      }
      return Promise.reject(new Error("other sources down"))
    }))

    const prices = await fetchTokenPrices()
    expect(prices.every((p) => p.source === "fallback")).toBe(true)
  })

  it("falls back gracefully when SO4 returns a non-ok HTTP status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("biscotti-proxy")) {
        return Promise.resolve({ ok: false, status: 503 })
      }
      return Promise.reject(new Error("other sources down"))
    }))

    const prices = await fetchTokenPrices()
    // Should reach dummy prices without throwing
    expect(Array.isArray(prices)).toBe(true)
    expect(prices.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// validateAndSortCandles
// ---------------------------------------------------------------------------

describe("validateAndSortCandles", () => {
  const bar = (time: number, open = 100, high = 105, low = 95, close = 102) => ({
    time, open, high, low, close,
  })

  it("returns an empty array for non-array input", () => {
    // @ts-expect-error intentional bad input
    expect(validateAndSortCandles(null)).toEqual([])
    // @ts-expect-error intentional bad input
    expect(validateAndSortCandles("bad")).toEqual([])
  })

  it("sorts candles chronologically", () => {
    const result = validateAndSortCandles([bar(300), bar(100), bar(200)])
    expect(result.map((c) => c.time)).toEqual([100, 200, 300])
  })

  it("drops candles with non-positive prices", () => {
    const result = validateAndSortCandles([
      bar(100),
      { time: 200, open: -1, high: 105, low: 95, close: 102 },
      { time: 300, open: 100, high: 105, low: 95, close: 0 },
    ])
    expect(result.length).toBe(1)
    expect(result[0]?.time).toBe(100)
  })

  it("drops candles where high < low", () => {
    const invalid = { time: 100, open: 100, high: 90, low: 95, close: 100 }
    expect(validateAndSortCandles([invalid])).toEqual([])
  })

  it("drops candles where high < open or high < close", () => {
    const highLtOpen = { time: 100, open: 110, high: 105, low: 95, close: 100 }
    const highLtClose = { time: 200, open: 100, high: 105, low: 95, close: 110 }
    expect(validateAndSortCandles([highLtOpen])).toEqual([])
    expect(validateAndSortCandles([highLtClose])).toEqual([])
  })

  it("drops duplicate timestamps, keeping the first encountered", () => {
    const result = validateAndSortCandles([bar(100), bar(100, 101)])
    expect(result.length).toBe(1)
    expect(result[0]?.open).toBe(100)
  })

  it("converts millisecond timestamps to seconds", () => {
    const msBar = { time: 100_000 * 1000, open: 100, high: 105, low: 95, close: 102 }
    const result = validateAndSortCandles([msBar])
    expect(result[0]?.time).toBe(100_000)
  })

  it("drops candles with non-finite or zero timestamps", () => {
    const bad = [
      { time: NaN, open: 100, high: 105, low: 95, close: 102 },
      { time: 0, open: 100, high: 105, low: 95, close: 102 },
      { time: -100, open: 100, high: 105, low: 95, close: 102 },
    ]
    expect(validateAndSortCandles(bad)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Pyth Benchmarks candle fetching & 4xx fallback (Issue #852)
// ---------------------------------------------------------------------------

describe("Pyth Benchmarks candle fetching & 4xx fallback", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    server.resetHandlers()
  })

  it("fetches and validates candles when Pyth Benchmarks returns 200", async () => {
    server.use(
      http.get("https://benchmarks.pyth.network/v1/shims/tradingview/history", () => {
        return HttpResponse.json({
          s: "ok",
          t: [1700000000, 1700000300],
          o: [80000, 80100],
          h: [80500, 80600],
          l: [79500, 79900],
          c: [80200, 80400],
        })
      })
    )

    const bars = await fetchPythBenchmarkCandles("BTC", "5m", 10)
    expect(bars).toHaveLength(2)
    expect(bars[0]).toEqual({
      time: 1700000000,
      open: 80000,
      high: 80500,
      low: 79500,
      close: 80200,
    })
  })

  it("throws when Pyth Benchmarks returns 404", async () => {
    server.use(
      http.get("https://benchmarks.pyth.network/v1/shims/tradingview/history", () => {
        return new HttpResponse("Not Found", { status: 404 })
      })
    )

    await expect(fetchPythBenchmarkCandles("BTC", "5m", 10)).rejects.toThrow(/HTTP 404/)
  })

  it("fetchOracleCandles throws 'Chart data unavailable' when all sources return 404 or fail", async () => {
    server.use(
      http.get("https://api.binance.com/api/v3/klines", () => {
        return new HttpResponse("Not Found", { status: 404 })
      }),
      http.get("https://benchmarks.pyth.network/v1/shims/tradingview/history", () => {
        return new HttpResponse("Not Found", { status: 404 })
      }),
      http.get("*/prices/candles", () => {
        return new HttpResponse("Not Found", { status: 404 })
      })
    )

    await expect(fetchOracleCandles("BTC", "5m", 10)).rejects.toThrow(
      /Chart data unavailable for BTC: all candle sources failed/
    )
  })

  it("fetchOracleCandles successfully uses Pyth Benchmarks when Binance is unavailable", async () => {
    server.use(
      http.get("https://api.binance.com/api/v3/klines", () => {
        return new HttpResponse("Geo-blocked", { status: 451 })
      }),
      http.get("https://benchmarks.pyth.network/v1/shims/tradingview/history", () => {
        return HttpResponse.json({
          s: "ok",
          t: [1700000000],
          o: [80000],
          h: [80500],
          l: [79500],
          c: [80200],
        })
      })
    )

    const res = await fetchOracleCandles("BTC", "5m", 10)
    expect(res.venueName).toBe("Pyth Hermes Reference")
    expect(res.candles).toHaveLength(1)
    expect(res.candles[0]?.close).toBe(80200)
  })
})
