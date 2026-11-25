import { describe, expect, it, vi } from "vitest"
import {
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  buildPnlShareCard,
  drawPnlShareCard,
  positionShareUrl,
  resolveShareCardPalette,
  shareCardAltText,
  shareCardFileName,
  shareText,
  xIntentUrl,
} from "./pnl-share-card"
import type { ShareCardContext, ShareablePosition } from "./pnl-share-card"
import { SITE_NAME, SITE_URL, TWITTER_HANDLE } from "@/shared/lib/site-identity"

const position: ShareablePosition = {
  marketName: "BTC/USD",
  indexToken: "WBTC",
  isLong: true,
  leverage: 10,
  entryPrice: 50_000,
  markPrice: 51_000,
  pnlAfterFees: 950,
  pnlPercent: 9.5,
}

function recordingContext() {
  const texts: Array<string> = []
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn((text: string) => texts.push(text)),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
  }
  return { ctx: ctx as unknown as ShareCardContext, texts, raw: ctx }
}

describe("PnL share card (issue 955)", () => {
  it("uses Open Graph large-image dimensions", () => {
    expect([SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT]).toEqual([1200, 630])
  })

  it("builds the card from the position and the central site identity", () => {
    const card = buildPnlShareCard(position)
    expect(card).toMatchObject({
      siteName: SITE_NAME,
      siteHost: new URL(SITE_URL).host,
      market: "BTC/USD",
      side: "Long",
      leverage: "10x",
      pnlPercent: "+9.50%",
      entryPrice: "$50,000.00",
      markPrice: "$51,000.00",
      isProfit: true,
      url: `${SITE_URL}/trade?market=WBTC&type=long`,
    })
    expect(card.pnlUsd).toBeUndefined()
  })

  it("only includes the USD amount when opted in, and signs losses", () => {
    const loss = buildPnlShareCard(
      { ...position, isLong: false, pnlAfterFees: -1234.5, pnlPercent: -12.3, leverage: 2.5 },
      { includeUsd: true },
    )
    expect(loss).toMatchObject({
      side: "Short",
      leverage: "2.5x",
      pnlPercent: "-12.30%",
      pnlUsd: "-$1,234.50",
      isProfit: false,
    })
  })

  it("degrades gracefully on missing numbers", () => {
    const card = buildPnlShareCard({
      ...position,
      leverage: 0,
      entryPrice: 0,
      markPrice: Number.NaN,
      pnlPercent: Number.NaN,
    })
    expect(card).toMatchObject({ leverage: "—", entryPrice: "—", markPrice: "—", pnlPercent: "0.00%" })
  })

  it("writes share text, alt text, X intent, file name and deeplink", () => {
    const card = buildPnlShareCard(position, { includeUsd: true })
    expect(shareText(card)).toBe(`Long BTC/USD 10x · +9.50% on ${SITE_NAME} ${TWITTER_HANDLE}`)
    expect(shareCardAltText(card)).toContain("Long BTC/USD at 10x, PnL +9.50%, +$950.00")
    const intent = new URL(xIntentUrl(card))
    expect(intent.searchParams.get("url")).toBe(card.url)
    expect(intent.searchParams.get("text")).toBe(shareText(card))
    expect(shareCardFileName(position)).toBe("so4-market-btc-usd-long-pnl.png")
    expect(positionShareUrl({ indexToken: "X Y", isLong: false })).toBe(
      `${SITE_URL}/trade?market=X+Y&type=short`,
    )
  })

  it("draws every card field and colours the result by profit or loss", () => {
    const palette = resolveShareCardPalette()
    const { ctx, texts, raw } = recordingContext()
    const card = buildPnlShareCard(position, { includeUsd: true })
    drawPnlShareCard(ctx, card, { ...palette, long: "LONG", short: "SHORT" })

    expect(texts).toEqual(
      expect.arrayContaining([
        SITE_NAME,
        card.siteHost,
        "BTC/USD",
        "Long · 10x",
        "+9.50%",
        "+$950.00",
        "$50,000.00",
        "$51,000.00",
        TWITTER_HANDLE,
      ]),
    )
    expect(raw.fillRect).toHaveBeenCalledWith(0, 0, 1200, 630)

    const loss = recordingContext()
    drawPnlShareCard(loss.ctx, buildPnlShareCard({ ...position, pnlAfterFees: -1, pnlPercent: -1 }), {
      ...palette,
      long: "LONG",
      short: "SHORT",
    })
    expect(loss.texts).not.toContain("+$950.00")
    expect(loss.raw.fillStyle).not.toBe("LONG")
  })

  it("resolves a complete palette even without a stylesheet", () => {
    const palette = resolveShareCardPalette()
    for (const value of Object.values(palette)) expect(value).toBeTruthy()
    expect(document.body.querySelector(".dark[hidden]")).toBeNull()
  })
})
