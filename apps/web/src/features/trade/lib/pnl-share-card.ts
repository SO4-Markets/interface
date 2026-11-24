/**
 * "Share PnL" card (issue 955): a 1200×630 image of a position's result, sized for
 * the Open Graph / X `summary_large_image` slot, rendered client-side on a
 * canvas so no position data leaves the browser until the trader shares it.
 *
 * Product name, domain and handle come from the central site identity; every
 * colour is read from the design tokens of the dark theme the landing page
 * uses, so the card matches the brand without hard-coded values.
 */
import {
  CHART_PALETTE_FALLBACKS,
  canvasColorConverter,
  toChartColor,
} from "./chart-theme"
import { SITE_NAME, SITE_URL, TWITTER_HANDLE } from "@/shared/lib/site-identity"

export const SHARE_CARD_WIDTH = 1200
export const SHARE_CARD_HEIGHT = 630

export type ShareablePosition = {
  marketName: string
  indexToken: string
  isLong: boolean
  leverage: number
  entryPrice: number
  markPrice: number
  pnlAfterFees: number
  pnlPercent: number
}

export type PnlShareCard = {
  siteName: string
  siteHost: string
  market: string
  side: "Long" | "Short"
  leverage: string
  pnlPercent: string
  /** Absent unless the trader opts in to showing the dollar amount. */
  pnlUsd?: string
  entryPrice: string
  markPrice: string
  isProfit: boolean
  /** Deeplink that opens the same market and side on the trade page. */
  url: string
}

const usd = (value: number, maximumFractionDigits = 2) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits,
  }).format(value)

function priceText(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—"
  return usd(value, value < 1 ? 6 : value < 100 ? 4 : 2)
}

function signed(text: string, value: number): string {
  return value > 0 ? `+${text}` : text
}

/** Trade-page deeplink for a position, on the canonical site domain. */
export function positionShareUrl(position: Pick<ShareablePosition, "indexToken" | "isLong">): string {
  const params = new URLSearchParams({
    market: position.indexToken,
    type: position.isLong ? "long" : "short",
  })
  return `${SITE_URL}/trade?${params.toString()}`
}

export function buildPnlShareCard(
  position: ShareablePosition,
  { includeUsd = false }: { includeUsd?: boolean } = {},
): PnlShareCard {
  const pnlPercent = Number.isFinite(position.pnlPercent) ? position.pnlPercent : 0
  const pnlUsd = Number.isFinite(position.pnlAfterFees) ? position.pnlAfterFees : 0
  return {
    siteName: SITE_NAME,
    siteHost: new URL(SITE_URL).host,
    market: position.marketName,
    side: position.isLong ? "Long" : "Short",
    leverage:
      Number.isFinite(position.leverage) && position.leverage > 0
        ? `${position.leverage.toFixed(position.leverage % 1 === 0 ? 0 : 1)}x`
        : "—",
    pnlPercent: signed(`${pnlPercent.toFixed(2)}%`, pnlPercent),
    pnlUsd: includeUsd ? signed(usd(pnlUsd), pnlUsd) : undefined,
    entryPrice: priceText(position.entryPrice),
    markPrice: priceText(position.markPrice),
    isProfit: pnlUsd >= 0,
    url: positionShareUrl(position),
  }
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

/** e.g. `so4-market-btc-usd-long-pnl.png`, prefixed with the site name. */
export function shareCardFileName(position: Pick<ShareablePosition, "marketName" | "isLong">): string {
  return `${slugify(SITE_NAME)}-${slugify(position.marketName)}-${position.isLong ? "long" : "short"}-pnl.png`
}

/** Text the share sheet / X intent posts alongside the image. */
export function shareText(card: PnlShareCard): string {
  return `${card.side} ${card.market} ${card.leverage} · ${card.pnlPercent} on ${card.siteName} ${TWITTER_HANDLE}`
}

/** Screen-reader description of the card image. */
export function shareCardAltText(card: PnlShareCard): string {
  const usdPart = card.pnlUsd ? `, ${card.pnlUsd}` : ""
  return `${card.siteName} position card: ${card.side} ${card.market} at ${card.leverage}, PnL ${card.pnlPercent}${usdPart}. Entry ${card.entryPrice}, mark ${card.markPrice}.`
}

export function xIntentUrl(card: PnlShareCard): string {
  const params = new URLSearchParams({ text: shareText(card), url: card.url })
  return `https://twitter.com/intent/tweet?${params.toString()}`
}

export type ShareCardPalette = {
  background: string
  foreground: string
  muted: string
  border: string
  long: string
  short: string
  accent: string
}

const SHARE_CARD_TOKENS: Record<keyof ShareCardPalette, `--${string}`> = {
  background: "--background",
  foreground: "--foreground",
  muted: "--muted-foreground",
  border: "--border",
  long: "--long",
  short: "--short",
  accent: "--primary",
}

function fallbackPalette(): ShareCardPalette {
  const dark = CHART_PALETTE_FALLBACKS.dark
  return {
    background: dark.background,
    foreground: dark.text,
    muted: dark.text,
    border: dark.border,
    long: dark.long,
    short: dark.short,
    accent: dark.long,
  }
}

/**
 * Resolves the card palette from the dark-theme tokens. A detached probe with
 * the `dark` class is attached briefly so the card is on-brand regardless of
 * the trader's own light/dark preference.
 */
export function resolveShareCardPalette(): ShareCardPalette {
  const fallback = fallbackPalette()
  if (typeof document === "undefined" || typeof window === "undefined") return fallback

  const probe = document.createElement("div")
  probe.className = "dark"
  probe.hidden = true
  document.body.appendChild(probe)
  try {
    const computed = window.getComputedStyle(probe)
    const convert = canvasColorConverter()
    const palette = { ...fallback }
    for (const role of Object.keys(SHARE_CARD_TOKENS) as Array<keyof ShareCardPalette>) {
      const value = toChartColor(computed.getPropertyValue(SHARE_CARD_TOKENS[role]), convert)
      if (value) palette[role] = value
    }
    return palette
  } finally {
    probe.remove()
  }
}

/** The subset of CanvasRenderingContext2D the card uses; eases testing. */
export type ShareCardContext = Pick<
  CanvasRenderingContext2D,
  | "fillStyle"
  | "strokeStyle"
  | "lineWidth"
  | "font"
  | "textAlign"
  | "textBaseline"
  | "fillRect"
  | "strokeRect"
  | "fillText"
  | "beginPath"
  | "moveTo"
  | "lineTo"
  | "stroke"
>

const FONT_STACK = '"Geist Variable", ui-sans-serif, system-ui, sans-serif'
const MONO_STACK = 'ui-monospace, "SFMono-Regular", Menlo, monospace'

export function drawPnlShareCard(
  ctx: ShareCardContext,
  card: PnlShareCard,
  palette: ShareCardPalette,
): void {
  const W = SHARE_CARD_WIDTH
  const H = SHARE_CARD_HEIGHT
  const pad = 72
  const tone = card.isProfit ? palette.long : palette.short

  ctx.fillStyle = palette.background
  ctx.fillRect(0, 0, W, H)
  // Brand rule along the top and a result-coloured rule on the left.
  ctx.fillStyle = palette.accent
  ctx.fillRect(0, 0, W, 8)
  ctx.fillStyle = tone
  ctx.fillRect(0, 8, 8, H - 8)

  ctx.textBaseline = "alphabetic"
  ctx.textAlign = "left"

  ctx.fillStyle = palette.foreground
  ctx.font = `600 34px ${FONT_STACK}`
  ctx.fillText(card.siteName, pad, pad + 24)

  ctx.textAlign = "right"
  ctx.fillStyle = palette.muted
  ctx.font = `400 26px ${FONT_STACK}`
  ctx.fillText(card.siteHost, W - pad, pad + 24)

  ctx.textAlign = "left"
  ctx.fillStyle = palette.foreground
  ctx.font = `600 52px ${FONT_STACK}`
  ctx.fillText(card.market, pad, 210)

  ctx.fillStyle = tone
  ctx.font = `600 34px ${FONT_STACK}`
  ctx.fillText(`${card.side} · ${card.leverage}`, pad, 262)

  ctx.font = `700 148px ${MONO_STACK}`
  ctx.fillText(card.pnlPercent, pad, 420)

  if (card.pnlUsd) {
    ctx.fillStyle = palette.muted
    ctx.font = `500 40px ${MONO_STACK}`
    ctx.fillText(card.pnlUsd, pad, 480)
  }

  ctx.strokeStyle = palette.border
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(pad, 520)
  ctx.lineTo(W - pad, 520)
  ctx.stroke()

  const columns: Array<[string, string]> = [
    ["Entry price", card.entryPrice],
    ["Mark price", card.markPrice],
  ]
  columns.forEach(([label, value], i) => {
    const x = pad + i * 340
    ctx.fillStyle = palette.muted
    ctx.font = `400 22px ${FONT_STACK}`
    ctx.fillText(label, x, 560)
    ctx.fillStyle = palette.foreground
    ctx.font = `500 30px ${MONO_STACK}`
    ctx.fillText(value, x, 598)
  })

  ctx.textAlign = "right"
  ctx.fillStyle = palette.muted
  ctx.font = `400 22px ${FONT_STACK}`
  ctx.fillText(TWITTER_HANDLE, W - pad, 598)
}
