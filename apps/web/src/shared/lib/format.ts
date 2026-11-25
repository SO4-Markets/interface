// Centralised number / currency / address / date formatting
// Every feature should import from here instead of defining inline helpers.

// ─── Guard ───────────────────────────────────────────────────────────────────

const FALLBACK = "—"
const SMALL_THRESHOLD = 0.0001

function isBad(n: number | undefined | null): n is undefined | null {
  return n == null || !isFinite(n)
}

function normalize(n: number): number {
  return Object.is(n, -0) ? 0 : n
}

const DEFAULT_LOCALE = "en-US"

// ─── USD / Currency ─────────────────────────────────────────────────────────

type FormatCurrencyOpts = {
  locale?: string
  currency?: string
  decimals?: number
  compact?: boolean
}

export function formatUsd(
  n: number | undefined | null,
  opts?: FormatCurrencyOpts,
): string {
  if (isBad(n)) return FALLBACK

  const { locale = DEFAULT_LOCALE, currency = "USD", decimals = 2, compact = false } = opts ?? {}
  const value = normalize(n)

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: compact ? 0 : decimals,
    maximumFractionDigits: decimals,
    ...(compact ? { notation: "compact" as const } : {}),
  }).format(value)
}

export const formatCurrency = formatUsd

// ─── Compact number ──────────────────────────────────────────────────────────

type FormatCompactOpts = {
  locale?: string
  decimals?: number
}

export function formatCompact(
  n: number | undefined | null,
  opts?: FormatCompactOpts,
): string {
  if (isBad(n)) return FALLBACK

  const { locale = DEFAULT_LOCALE, decimals = 1 } = opts ?? {}
  const value = normalize(n)

  if (Math.abs(value) >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(decimals)}B`
  }
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(decimals)}M`
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(decimals)}K`
  }

  return value.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })
}

// ─── Generic Number ──────────────────────────────────────────────────────────

export type FormatNumberOpts = {
  locale?: string
  decimals?: number
  minDecimals?: number
}

export function formatNumber(
  n: number | undefined | null,
  opts?: FormatNumberOpts,
): string {
  if (isBad(n)) return FALLBACK

  const { locale = DEFAULT_LOCALE, decimals, minDecimals = 0 } = opts ?? {}
  const value = normalize(n)

  return value.toLocaleString(locale, {
    minimumFractionDigits: minDecimals,
    ...(decimals !== undefined ? { maximumFractionDigits: decimals } : {}),
  })
}

// ─── Market Precision ────────────────────────────────────────────────────────

export type FormatMarketPriceOpts = {
  locale?: string
  decimals?: number
  minDecimals?: number
  tickSize?: number
}

export function formatMarketPrice(
  price: number | undefined | null,
  opts?: FormatMarketPriceOpts | number,
): string {
  if (isBad(price)) return FALLBACK

  const options = typeof opts === "number" ? { decimals: opts } : (opts ?? {})
  const { locale = DEFAULT_LOCALE, minDecimals = 2 } = options
  let decimals = options.decimals
  if (decimals === undefined && options.tickSize && options.tickSize > 0) {
    const tickStr = options.tickSize.toString()
    const decIndex = tickStr.indexOf(".")
    decimals = decIndex >= 0 ? tickStr.length - decIndex - 1 : 0
  }
  const maxDec = Math.max(decimals ?? 2, minDecimals)
  const value = normalize(price)

  return value.toLocaleString(locale, {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDec,
  })
}

export type FormatMarketAmountOpts = {
  locale?: string
  decimals?: number
  minDecimals?: number
}

export function formatMarketAmount(
  amount: number | undefined | null,
  opts?: FormatMarketAmountOpts | number,
): string {
  if (isBad(amount)) return FALLBACK

  const options = typeof opts === "number" ? { decimals: opts } : (opts ?? {})
  const { locale = DEFAULT_LOCALE, decimals = 4, minDecimals = 0 } = options
  const value = normalize(amount)

  return value.toLocaleString(locale, {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: decimals,
  })
}

// ─── Token ───────────────────────────────────────────────────────────────────

type FormatTokenOpts = {
  locale?: string
  decimals?: number
  minDecimals?: number
}

export function formatToken(
  n: number | undefined | null,
  symbol: string,
  opts?: FormatTokenOpts,
): string {
  if (isBad(n)) return FALLBACK

  const { locale = DEFAULT_LOCALE, decimals = 4, minDecimals = 0 } = opts ?? {}
  const value = normalize(n)

  const formatted = value.toLocaleString(locale, {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: decimals,
  })

  return `${formatted} ${symbol}`
}

// ─── Small values ────────────────────────────────────────────────────────────

type FormatSmallOpts = {
  locale?: string
  decimals?: number
  threshold?: number
}

export function formatSmall(
  n: number | undefined | null,
  opts?: FormatSmallOpts,
): string {
  if (isBad(n)) return FALLBACK

  const { locale = DEFAULT_LOCALE, decimals = 4, threshold = SMALL_THRESHOLD } = opts ?? {}
  const value = normalize(n)

  if (value !== 0 && Math.abs(value) < threshold) {
    const minStr = threshold.toLocaleString(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    return `<${minStr}`
  }

  return value.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })
}

// ─── Percentage ──────────────────────────────────────────────────────────────

type FormatPctOpts = {
  locale?: string
  decimals?: number
  sign?: boolean
}

export function formatPct(
  n: number | undefined | null,
  opts?: FormatPctOpts,
): string {
  if (isBad(n)) return FALLBACK

  const { locale = DEFAULT_LOCALE, decimals = 2, sign = true } = opts ?? {}
  const value = normalize(n)
  const prefix = sign ? (value >= 0 ? "+" : "") : ""

  const formattedNum = value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  return `${prefix}${formattedNum}%`
}

export const formatPercent = formatPct

// ─── Date / Time ─────────────────────────────────────────────────────────────

type FormatDateOpts = {
  locale?: string
  year?: "numeric" | "2-digit"
  month?: "numeric" | "2-digit" | "short" | "long"
  day?: "numeric" | "2-digit"
  timeZone?: string
}

export function formatDate(
  date: Date | string | number | undefined | null,
  opts?: FormatDateOpts,
): string {
  if (date == null) return FALLBACK

  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return FALLBACK

  const {
    locale = DEFAULT_LOCALE,
    year = "numeric",
    month = "short",
    day = "numeric",
    timeZone,
  } = opts ?? {}

  return new Intl.DateTimeFormat(locale, {
    year,
    month,
    day,
    timeZone,
  }).format(d)
}

type FormatTimeOpts = {
  locale?: string
  hour?: "numeric" | "2-digit"
  minute?: "2-digit"
  second?: "2-digit"
  timeZone?: string
  timeZoneName?: "short" | "long"
}

export function formatTime(
  date: Date | string | number | undefined | null,
  opts?: FormatTimeOpts,
): string {
  if (date == null) return FALLBACK

  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return FALLBACK

  const {
    locale = DEFAULT_LOCALE,
    hour = "2-digit",
    minute = "2-digit",
    second,
    timeZone,
    timeZoneName,
  } = opts ?? {}

  return new Intl.DateTimeFormat(locale, {
    hour,
    minute,
    ...(second != null ? { second } : {}),
    ...(timeZone != null ? { timeZone } : {}),
    ...(timeZoneName != null ? { timeZoneName } : {}),
  }).format(d)
}

type FormatDateTimeOpts = FormatDateOpts & FormatTimeOpts

export function formatDateTime(
  date: Date | string | number | undefined | null,
  opts?: FormatDateTimeOpts,
): string {
  if (date == null) return FALLBACK

  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return FALLBACK

  const {
    locale = DEFAULT_LOCALE,
    year = "numeric",
    month = "short",
    day = "numeric",
    hour = "2-digit",
    minute = "2-digit",
    second,
    timeZone,
    timeZoneName,
  } = opts ?? {}

  return new Intl.DateTimeFormat(locale, {
    year,
    month,
    day,
    hour,
    minute,
    ...(second != null ? { second } : {}),
    ...(timeZone != null ? { timeZone } : {}),
    ...(timeZoneName != null ? { timeZoneName } : {}),
  }).format(d)
}

// ─── Relative time ───────────────────────────────────────────────────────────

type RelativeTimeUnit = "year" | "quarter" | "month" | "week" | "day" | "hour" | "minute" | "second"

type FormatRelativeTimeOpts = {
  locale?: string
  numeric?: "always" | "auto"
  style?: "long" | "short" | "narrow"
}

const RELATIVE_UNIT_LIMITS: Array<[number, RelativeTimeUnit]> = [
  [60, "second"],
  [3600, "minute"],
  [86400, "hour"],
  [2592000, "day"],
  [31536000, "month"],
  [Infinity, "year"],
]

function closestUnit(seconds: number): { value: number; unit: RelativeTimeUnit } {
  const abs = Math.abs(seconds)
  for (const [limit, unit] of RELATIVE_UNIT_LIMITS) {
    if (abs < limit) {
      const value = unit === "second" ? Math.round(seconds) : Math.floor(seconds / (limit / (unit === "minute" ? 60 : 1)))
      return { value, unit }
    }
  }
  return { value: Math.floor(seconds / 31536000), unit: "year" }
}

export function formatRelativeTime(
  date: Date | string | number | undefined | null,
  opts?: FormatRelativeTimeOpts,
): string {
  if (date == null) return FALLBACK

  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return FALLBACK

  const { locale = DEFAULT_LOCALE, numeric = "auto", style = "short" } = opts ?? {}

  const now = Date.now()
  const diffMs = d.getTime() - now
  const diffSec = Math.round(diffMs / 1000)

  const { value, unit } = closestUnit(diffSec)

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric, style })
  return rtf.format(value, unit)
}

// ─── Address ─────────────────────────────────────────────────────────────────

export function formatAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr || FALLBACK
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

// ─── Tx Hash ─────────────────────────────────────────────────────────────────

export function formatTxHash(hash: string): string {
  if (!hash || hash.length < 14) return hash || FALLBACK
  return `${hash.slice(0, 8)}…${hash.slice(-4)}`
}