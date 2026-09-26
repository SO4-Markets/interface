import { describe, expect, it } from "vitest"
import { calculateDepthImpact, getProtectionPrice, type VerifiedDepth } from "./fee-preview"

const depth: VerifiedDepth = {
  source: "verified",
  updatedAt: 1_000,
  asks: [{ price: 101, size: 5 }, { price: 102, size: 10 }],
  bids: [{ price: 99, size: 5 }, { price: 98, size: 10 }],
}

describe("fee and execution preview", () => {
  it("calculates adverse impact on both sides from verified depth", () => {
    const long = calculateDepthImpact({ side: "long", orderValueUsd: 505, referencePrice: 100, depth, now: 1_000 })
    const short = calculateDepthImpact({ side: "short", orderValueUsd: 495, referencePrice: 100, depth, now: 1_000 })

    expect(long.status).toBe("estimated")
    expect(long.impactPct).toBeGreaterThan(0)
    expect(short.status).toBe("estimated")
    expect(short.impactPct).toBeGreaterThan(0)
  })

  it("reports insufficient depth instead of returning zero impact", () => {
    const result = calculateDepthImpact({ side: "long", orderValueUsd: 10_000, referencePrice: 100, depth, now: 1_000 })
    expect(result.status).toBe("insufficient")
    expect(result.impactPct).toBeNull()
  })

  it("reports stale and reference depth explicitly", () => {
    expect(calculateDepthImpact({ side: "long", orderValueUsd: 100, referencePrice: 100, depth, now: 7_000 }).status).toBe("stale")
    expect(calculateDepthImpact({
      side: "long",
      orderValueUsd: 100,
      referencePrice: 100,
      depth: { ...depth, source: "reference" },
      now: 1_000,
    }).status).toBe("unknown")
  })

  it("uses the same protection bounds for preview and submission", () => {
    expect(getProtectionPrice({ referencePrice: 100, isLong: true, slippagePct: 0.5 })).toBeCloseTo(100.5, 8)
    expect(getProtectionPrice({ referencePrice: 100, isLong: false, slippagePct: 0.5 })).toBeCloseTo(99.5, 8)
  })
})
