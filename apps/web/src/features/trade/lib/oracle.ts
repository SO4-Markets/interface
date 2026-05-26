// Oracle price feed — Binance public REST as primary, GMX oracle as automatic fallback.
//
// Candle format differences:
//   Binance klines → oldest-first, prices as strings, times in milliseconds
//   GMX candles   → newest-first, prices as numbers, times in seconds
//
// Both are normalised into OhlcBar (oldest-first, prices as numbers, time in seconds).

export type TokenPrice = {
  symbol: string
  address: string
  minPrice: number
  maxPrice: number
  updatedAt: number   // ms
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

import { ENV } from "../../../app/config/env"

const BINANCE_BASE = "https://api.binance.com"
const GMX_BASE = ENV.ORACLE_URL

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
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`
}

// ─── fetchTokenPrices ────────────────────────────────────────────────────────

type BinanceBookTicker = {
  symbol: string
  bidPrice: string
  askPrice: string
}

type GmxTicker = {
  minPrice: string
  maxPrice: string
  tokenSymbol: string
  tokenAddress: string
  updatedAt: number
}

export async function fetchTokenPrices(): Promise<TokenPrice[]> {
  // Try Binance first
  try {
    const syms = JSON.stringify(Object.values(BINANCE_SYMBOL))
    const res = await fetch(
      `${BINANCE_BASE}/api/v3/ticker/bookTicker?symbols=${encodeURIComponent(syms)}`,
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const tickers = (await res.json()) as BinanceBookTicker[]

    const liveMap = new Map<string, TokenPrice>()
    for (const t of tickers) {
      // Reverse map BTCUSDT → BTC
      const sym = Object.entries(BINANCE_SYMBOL).find(([, v]) => v === t.symbol)?.[0]
      if (!sym) continue
      const bid = parseFloat(t.bidPrice)
      const ask = parseFloat(t.askPrice)
      liveMap.set(sym, { symbol: sym, address: sym, minPrice: bid, maxPrice: ask, updatedAt: Date.now() })
    }
    return DUMMY_PRICES.map((d) => liveMap.get(d.symbol) ?? d)
  } catch {
    // Fall through to GMX
  }

  // Fallback: GMX oracle
  try {
    const res = await fetch(`${GMX_BASE}/prices/tickers`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const tickers = (await res.json()) as GmxTicker[]

    const liveMap = new Map<string, TokenPrice>()
    for (const t of tickers) {
      liveMap.set(t.tokenSymbol, {
        symbol: t.tokenSymbol,
        address: t.tokenAddress,
        minPrice: parseGmxPrice(t.minPrice, t.tokenSymbol),
        maxPrice: parseGmxPrice(t.maxPrice, t.tokenSymbol),
        updatedAt: t.updatedAt,
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
): Promise<OhlcBar[]> {
  // Try Binance first — klines are oldest-first, prices are strings, times in ms
  const binanceSym = BINANCE_SYMBOL[symbol]
  const binancePeriod = BINANCE_PERIOD[period]
  if (binanceSym && binancePeriod) {
    try {
      const params = new URLSearchParams({
        symbol: binanceSym,
        interval: binancePeriod,
        limit: String(Math.min(limit, 1000)),
      })
      const res = await fetch(`${BINANCE_BASE}/api/v3/klines?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const raw = (await res.json()) as (string | number)[][]
      // Binance klines: [openTime_ms, open, high, low, close, vol, ...] oldest-first
      return raw.map((c) => ({
        time: Math.floor(Number(c[0]) / 1000),
        open: parseFloat(c[1] as string),
        high: parseFloat(c[2] as string),
        low: parseFloat(c[3] as string),
        close: parseFloat(c[4] as string),
      }))
    } catch {
      // Fall through to GMX
    }
  }

  // Fallback: GMX oracle — candles are newest-first, values are plain USD numbers
  try {
    const params = new URLSearchParams({
      tokenSymbol: symbol,
      period: period === "1D" ? "1d" : period,
      limit: String(limit),
    })
    const res = await fetch(`${GMX_BASE}/prices/candles?${params}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as { candles: number[][] }
    // Reverse to get oldest-first
    return json.candles
      .map(([time, open, high, low, close]) => ({ time, open, high, low, close }))
      .reverse()
  } catch {
    return generateDummyBars(symbol, period, limit)
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
  // Try Binance first
  const binanceSym = BINANCE_SYMBOL[symbol]
  if (binanceSym) {
    try {
      const res = await fetch(
        `${BINANCE_BASE}/api/v3/ticker/24hr?symbol=${binanceSym}`,
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const t = (await res.json()) as Binance24hTicker
      const deltaPercentage = parseFloat(t.priceChangePercent)
      return {
        symbol,
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
    const all = (await res.json()) as GmxDayCandle[]
    const c = all.find((x) => x.tokenSymbol === symbol)
    if (!c) return DUMMY_24H[symbol] ?? null
    const deltaPercentage = c.open > 0 ? ((c.close - c.open) / c.open) * 100 : 0
    return {
      symbol,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      deltaPercentage,
      deltaPercentageStr: pctStr(deltaPercentage),
    }
  } catch {
    return DUMMY_24H[symbol] ?? null
  }
}

// ─── Fallback dummy data ─────────────────────────────────────────────────────

const DUMMY_PRICES: TokenPrice[] = [
  { symbol: "BTC",  address: "BTC",  minPrice: 80_000,  maxPrice: 80_050,  updatedAt: Date.now() },
  { symbol: "ETH",  address: "ETH",  minPrice: 2_300,   maxPrice: 2_302,   updatedAt: Date.now() },
  { symbol: "XLM",  address: "XLM",  minPrice: 0.167,   maxPrice: 0.1672,  updatedAt: Date.now() },
  { symbol: "USDC", address: "USDC", minPrice: 0.9998,  maxPrice: 1.0002,  updatedAt: Date.now() },
]

const DUMMY_24H: Record<string, PriceDelta24h> = {
  BTC: { symbol: "BTC", open: 79_200, high: 80_500, low: 79_000, close: 80_000, deltaPercentage: 1.01, deltaPercentageStr: "+1.01%" },
  ETH: { symbol: "ETH", open: 2_260,  high: 2_330,  low: 2_255,  close: 2_300,  deltaPercentage: 1.77, deltaPercentageStr: "+1.77%" },
  XLM: { symbol: "XLM", open: 0.158,  high: 0.169,  low: 0.157,  close: 0.167,  deltaPercentage: 5.70, deltaPercentageStr: "+5.70%" },
}

function generateDummyBars(symbol: string, _period: string, limit: number): OhlcBar[] {
  const seed = DUMMY_PRICES.find((p) => p.symbol === symbol)?.minPrice ?? 100
  const bars: OhlcBar[] = []
  const intervalSec = 5 * 60
  let price = seed
  let t = Math.floor(Date.now() / 1000) - limit * intervalSec

  for (let i = 0; i < limit; i++) {
    const change = (Math.random() - 0.49) * seed * 0.004
    const open = price
    const close = open + change
    const high = Math.max(open, close) + Math.abs(change) * Math.random()
    const low = Math.min(open, close) - Math.abs(change) * Math.random()
    bars.push({ time: t, open, high, low, close })
    price = close
    t += intervalSec
  }

  return bars
}
