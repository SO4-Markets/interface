// Oracle price feed — SO4 oracle (primary), Pyth Hermes (on-chain), Binance REST (display/candles).
//
// Symbol conventions used in this file:
//   base symbol  — "BTC", "ETH", "XLM", "USDC"  (used by external APIs)
//   test symbol  — "TWBTC", "TETH", "TXLM", "TUSDC" (our token symbols)
//   address      — Soroban contract ID (what the UI passes for the selected market)
//
// All public functions accept any of the three forms and resolve internally.

import { ENV } from "../../../app/config/env"
import { fetchPythAttestations } from "./pyth"
import { formatPct } from "@/shared/lib/format"

export type PriceSource = "so4" | "pyth" | "binance" | "gmx" | "fallback"

export type TokenPrice = {
  symbol: string
  address: string
  minPrice: number
  maxPrice: number
  updatedAt: number   // ms
  source: PriceSource
}

export type OhlcBar = {
  time: number    // Unix timestamp (seconds)
  open: number
  high: number
  low: number
  close: number
}

export type PriceDelta24h = {
  symbol: string
  open: number
  high: number
  low: number
  close: number
  deltaPercentage: number
  deltaPercentageStr: string
}

// ─── Symbol resolution ────────────────────────────────────────────────────────

// Maps our test token symbols to base symbols used by external price APIs
const TEST_TO_BASE: Record<string, string> = {
  TWBTC: "BTC", TETH: "ETH", TXLM: "XLM", TUSDC: "USDC",
}

// Resolves any of: contract address, test symbol (TWBTC), or base symbol (BTC)
// → always returns the base symbol (BTC, ETH, XLM, USDC)
function resolveBaseSymbol(symbolOrAddress: string): string {
  // Already a base symbol
  if (BINANCE_SYMBOL[symbolOrAddress]) return symbolOrAddress
  // Test token symbol (TWBTC → BTC)
  if (TEST_TO_BASE[symbolOrAddress]) return TEST_TO_BASE[symbolOrAddress]
  // Contract address — map via ENV token addresses
  const addrMap: Record<string, string> = {
    [ENV.CONTRACTS.TOKENS.TWBTC]: "BTC",
    [ENV.CONTRACTS.TOKENS.TETH]:  "ETH",
    [ENV.CONTRACTS.TOKENS.TXLM]:  "XLM",
    [ENV.CONTRACTS.TOKENS.TUSDC]: "USDC",
  }
  return addrMap[symbolOrAddress] ?? symbolOrAddress
}

// ─── Symbol / period mappings ────────────────────────────────────────────────

export const BINANCE_SYMBOL: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  XLM: "XLMUSDT",
  USDC: "USDCUSDT",
}

export const BINANCE_PERIOD: Record<string, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1D": "1d",
}

const BINANCE_BASE = "https://api.binance.com"
const GMX_BASE = ENV.ORACLE_URL

const TRACKED_SYMBOLS = ["BTC", "ETH", "XLM", "USDC"] as const

// GMX v2 price decimals: rawPrice = usdPrice × 10^(30 − tokenDecimals)
const TOKEN_DECIMALS: Record<string, number> = {
  BTC: 8, ETH: 18, XLM: 7, USDC: 6, USDT: 6,
}

function parseGmxPrice(raw: string, symbol: string): number {
  const scaleDec = 30 - (TOKEN_DECIMALS[symbol] ?? 18)
  if (scaleDec <= 0) return parseFloat(raw)
  const padded = raw.padStart(scaleDec + 1, "0")
  return parseFloat(`${padded.slice(0, -scaleDec)}.${padded.slice(-scaleDec)}`)
}

function pctStr(pct: number): string {
  return formatPct(pct)
}

// ─── SO4 Oracle (primary price source) ───────────────────────────────────────

const SO4_ORACLE_URL = "https://oracle.biscotti-proxy-worker.workers.dev"

type So4OracleTicker = {
  token: string    // contract address
  symbol: string   // TWBTC, TETH, TXLM, TUSDC
  min: number      // usdPrice × 10^30 (parsed as float — precision loss at low digits is acceptable)
  max: number
  timestamp: number // Unix seconds
}

async function fetchSo4OraclePrices(): Promise<Map<string, TokenPrice>> {
  const res = await fetch(`${SO4_ORACLE_URL}/prices`)
  if (!res.ok) throw new Error(`SO4 oracle HTTP ${res.status}`)
  const tickers = (await res.json()) as Array<So4OracleTicker>

  const map = new Map<string, TokenPrice>()
  for (const t of tickers) {
    const baseSymbol = TEST_TO_BASE[t.symbol]
    if (!baseSymbol) continue
    map.set(baseSymbol, {
      symbol: baseSymbol,
      address: t.token,
      minPrice: t.min / 1e30,
      maxPrice: t.max / 1e30,
      updatedAt: t.timestamp * 1_000,
      source: "so4",
    })
  }
  return map
}

// ─── Binance display fallback ─────────────────────────────────────────────────

type BinanceBookTicker = {
  symbol: string
  bidPrice: string
  askPrice: string
}

async function fetchBinanceDisplayPrices(): Promise<Map<string, TokenPrice>> {
  const syms = JSON.stringify(Object.values(BINANCE_SYMBOL))
  const res = await fetch(
    `${BINANCE_BASE}/api/v3/ticker/bookTicker?symbols=${encodeURIComponent(syms)}`,
  )
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const tickers = (await res.json()) as Array<BinanceBookTicker>

  const liveMap = new Map<string, TokenPrice>()
  for (const t of tickers) {
    const sym = Object.entries(BINANCE_SYMBOL).find(([, v]) => v === t.symbol)?.[0]
    if (!sym) continue
    const bid = parseFloat(t.bidPrice)
    const ask = parseFloat(t.askPrice)
    liveMap.set(sym, {
      symbol: sym,
      address: sym,
      minPrice: bid,
      maxPrice: ask,
      updatedAt: Date.now(),
      source: "binance",
    })
  }
  return liveMap
}

// ─── fetchTokenPrices ────────────────────────────────────────────────────────

type GmxTicker = {
  minPrice: string
  maxPrice: string
  tokenSymbol: string
  tokenAddress: string
  updatedAt: number
}

export async function fetchTokenPrices(): Promise<Array<TokenPrice>> {
  // Primary: SO4 oracle (deployed, aggregates Binance + Coinbase + Pyth)
  try {
    const so4Map = await fetchSo4OraclePrices()
    if (so4Map.size > 0) {
      return DUMMY_PRICES.map((d) => so4Map.get(d.symbol) ?? d)
    }
  } catch {
    // Fall through to Pyth
  }

  // Secondary: Pyth Hermes
  const pythMap = new Map<string, TokenPrice>()
  try {
    const attestations = await fetchPythAttestations([...TRACKED_SYMBOLS])
    for (const a of attestations) {
      pythMap.set(a.symbol, {
        symbol: a.symbol,
        address: a.symbol,
        minPrice: a.minPrice,
        maxPrice: a.maxPrice,
        updatedAt: a.publishTimeMs,
        source: "pyth",
      })
    }
  } catch {
    // Fall through
  }

  if (pythMap.size > 0) {
    let binanceMap = new Map<string, TokenPrice>()
    try {
      binanceMap = await fetchBinanceDisplayPrices()
    } catch {
      // Pyth-only is acceptable
    }
    return DUMMY_PRICES.map((d) => pythMap.get(d.symbol) ?? binanceMap.get(d.symbol) ?? d)
  }

  // Tertiary: Binance REST
  try {
    const binanceMap = await fetchBinanceDisplayPrices()
    return DUMMY_PRICES.map((d) => binanceMap.get(d.symbol) ?? d)
  } catch {
    // Fall through to GMX
  }

  // Last resort: GMX oracle
  try {
    const res = await fetch(`${GMX_BASE}/prices/tickers`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const tickers = (await res.json()) as Array<GmxTicker>

    const liveMap = new Map<string, TokenPrice>()
    for (const t of tickers) {
      liveMap.set(t.tokenSymbol, {
        symbol: t.tokenSymbol,
        address: t.tokenAddress,
        minPrice: parseGmxPrice(t.minPrice, t.tokenSymbol),
        maxPrice: parseGmxPrice(t.maxPrice, t.tokenSymbol),
        updatedAt: t.updatedAt,
        source: "gmx",
      })
    }
    return DUMMY_PRICES.map((d) => liveMap.get(d.symbol) ?? d)
  } catch {
    return DUMMY_PRICES
  }
}

// ─── fetchOracleCandles ──────────────────────────────────────────────────────

export async function fetchOracleCandles(
  symbol: string,
  period: string,
  limit = 500,
  signal?: AbortSignal,
): Promise<Array<OhlcBar>> {
  if (signal?.aborted) return []
  // Resolve contract address / test symbol → base symbol (BTC, ETH, XLM, USDC)
  const base = resolveBaseSymbol(symbol)

  // Try Binance first — klines are oldest-first, prices are strings, times in ms
  const binanceSym = BINANCE_SYMBOL[base]
  const binancePeriod = BINANCE_PERIOD[period]
  if (binanceSym && binancePeriod) {
    try {
      const params = new URLSearchParams({
        symbol: binanceSym,
        interval: binancePeriod,
        limit: String(Math.min(limit, 1000)),
      })
      const res = await fetch(`${BINANCE_BASE}/api/v3/klines?${params}`, { signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const raw = (await res.json()) as Array<Array<string | number>>
      if (signal?.aborted) return []
      // Binance klines: [openTime_ms, open, high, low, close, vol, ...] oldest-first
      return raw.map((c) => ({
        time: Math.floor(Number(c[0]) / 1000),
        open: parseFloat(c[1] as string),
        high: parseFloat(c[2] as string),
        low: parseFloat(c[3] as string),
        close: parseFloat(c[4] as string),
      }))
    } catch {
      if (signal?.aborted) return []
      // Fall through to Pyth Benchmarks
    }
  }

  // Fallback: Pyth Benchmarks (reliable, no geo-blocking)
  try {
    return await fetchPythBenchmarkCandles(base, period, limit, signal)
  } catch {
    if (signal?.aborted) return []
    // Fall through to GMX
  }

  // Last resort: GMX oracle — candles are newest-first, values are plain USD numbers
  try {
    const params = new URLSearchParams({
      tokenSymbol: base,
      period: period === "1D" ? "1d" : period,
      limit: String(limit),
    })
    const res = await fetch(`${GMX_BASE}/prices/candles?${params}`, { signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as { candles: Array<Array<number>> }
    if (signal?.aborted) return []
    // Reverse to get oldest-first
    return json.candles
      .map(([time, open, high, low, close]) => ({ time, open, high, low, close }))
      .reverse()
  } catch {
    return []
  }
}

// ─── fetch24hPriceDelta ──────────────────────────────────────────────────────

type Binance24hTicker = {
  symbol: string
  openPrice: string
  highPrice: string
  lowPrice: string
  lastPrice: string
  priceChangePercent: string
}

type GmxDayCandle = {
  tokenSymbol: string
  high: number
  low: number
  open: number
  close: number
}

export async function fetch24hPriceDelta(symbol: string): Promise<PriceDelta24h | null> {
  const base = resolveBaseSymbol(symbol)

  // Try Binance first
  const binanceSym = BINANCE_SYMBOL[base]
  if (binanceSym) {
    try {
      const res = await fetch(
        `${BINANCE_BASE}/api/v3/ticker/24hr?symbol=${binanceSym}`,
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const t = (await res.json()) as Binance24hTicker
      const deltaPercentage = parseFloat(t.priceChangePercent)
      return {
        symbol: base,
        open: parseFloat(t.openPrice),
        high: parseFloat(t.highPrice),
        low: parseFloat(t.lowPrice),
        close: parseFloat(t.lastPrice),
        deltaPercentage,
        deltaPercentageStr: pctStr(deltaPercentage),
      }
    } catch {
      // Fall through to GMX
    }
  }

  // Fallback: GMX oracle
  try {
    const res = await fetch(`${GMX_BASE}/prices/24h`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const all = (await res.json()) as Array<GmxDayCandle>
    const c = all.find((x) => x.tokenSymbol === base)
    if (!c) return DUMMY_24H[base] ?? null
    const deltaPercentage = c.open > 0 ? ((c.close - c.open) / c.open) * 100 : 0
    return {
      symbol: base,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      deltaPercentage,
      deltaPercentageStr: pctStr(deltaPercentage),
    }
  } catch {
    return DUMMY_24H[base] ?? null
  }
}

// ─── Pyth Benchmarks candle fallback ─────────────────────────────────────────

const PYTH_BENCHMARKS_BASE = "https://benchmarks.pyth.network"

const PYTH_BENCHMARKS_RESOLUTION: Record<string, string> = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "1h": "60",
  "4h": "240",
  "1D": "1D",
}

const PYTH_SYMBOL: Record<string, string> = {
  BTC: "Crypto.BTC/USD",
  ETH: "Crypto.ETH/USD",
  XLM: "Crypto.XLM/USD",
  USDC: "Crypto.USDC/USD",
}

const PERIOD_SECONDS: Record<string, number> = {
  "1m": 60,
  "5m": 5 * 60,
  "15m": 15 * 60,
  "1h": 60 * 60,
  "4h": 4 * 60 * 60,
  "1D": 24 * 60 * 60,
}

type PythBenchmarksResponse = {
  s: string
  t: Array<number>
  o: Array<number>
  h: Array<number>
  l: Array<number>
  c: Array<number>
}

async function fetchPythBenchmarkCandles(
  symbol: string,
  period: string,
  limit: number,
  signal?: AbortSignal,
): Promise<Array<OhlcBar>> {
  const pythSym = PYTH_SYMBOL[symbol]
  const resolution = PYTH_BENCHMARKS_RESOLUTION[period]
  if (!pythSym || !resolution) {
    throw new Error(`No Pyth Benchmarks mapping for symbol=${symbol} period=${period}`)
  }

  const intervalSec = PERIOD_SECONDS[period] ?? 5 * 60
  const to = Math.floor(Date.now() / 1000)
  const from = to - limit * intervalSec

  const params = new URLSearchParams({
    symbol: pythSym,
    resolution,
    from: String(from),
    to: String(to),
  })
  const res = await fetch(`${PYTH_BENCHMARKS_BASE}/v1/shims/tradingview/history?${params}`, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const json = (await res.json()) as PythBenchmarksResponse
  if (json.s !== "ok" || !Array.isArray(json.t) || json.t.length === 0) {
    throw new Error("Pyth Benchmarks returned no data")
  }

  return json.t.map((time, i) => ({
    time,
    open: json.o[i],
    high: json.h[i],
    low: json.l[i],
    close: json.c[i],
  }))
}

// ─── Fallback dummy data ─────────────────────────────────────────────────────

const DUMMY_PRICES: Array<TokenPrice> = [
  { symbol: "BTC",  address: "BTC",  minPrice: 80_000,  maxPrice: 80_050,  updatedAt: Date.now(), source: "fallback" },
  { symbol: "ETH",  address: "ETH",  minPrice: 2_300,   maxPrice: 2_302,   updatedAt: Date.now(), source: "fallback" },
  { symbol: "XLM",  address: "XLM",  minPrice: 0.167,   maxPrice: 0.1672,  updatedAt: Date.now(), source: "fallback" },
  { symbol: "USDC", address: "USDC", minPrice: 0.9998,  maxPrice: 1.0002,  updatedAt: Date.now(), source: "fallback" },
]

const DUMMY_24H: Record<string, PriceDelta24h> = {
  BTC: { symbol: "BTC", open: 79_200, high: 80_500, low: 79_000, close: 80_000, deltaPercentage: 1.01, deltaPercentageStr: "+1.01%" },
  ETH: { symbol: "ETH", open: 2_260,  high: 2_330,  low: 2_255,  close: 2_300,  deltaPercentage: 1.77, deltaPercentageStr: "+1.77%" },
  XLM: { symbol: "XLM", open: 0.158,  high: 0.169,  low: 0.157,  close: 0.167,  deltaPercentage: 5.70, deltaPercentageStr: "+5.70%" },
}
