import { describe, expect, it } from "vitest"
import { estimateClosePreview, formatPartialPresetUsd } from "./partial-close"
import { partialSizeToRaw, validateClosePayload } from "./position-constraints"

describe("partial-close helpers", () => {
  it("formats whole-cent presets cleanly and preserves sub-cent precision", () => {
    expect(formatPartialPresetUsd(50_000, 25)).toBe("12500.00")
    expect(formatPartialPresetUsd(50_000, 50)).toBe("25000.00")
    expect(formatPartialPresetUsd(100.333333, 25)).toBe("25.083333")
    expect(formatPartialPresetUsd(0, 25)).toBe("")
  })

  it("preserves raw bigint precision for partial close ratios", () => {
    const sizeInUsdRaw = 100_333_333_000_000_000_000_000_000_000_000n // 100.333333 * 1e30
    const sizeUsd = 100.333333
    const partialStr = formatPartialPresetUsd(sizeUsd, 25)
    const raw = partialSizeToRaw(Number(partialStr), { sizeUsd, sizeInUsdRaw })

    expect(raw).toBeDefined()
    const ratio = Number(raw!) / Number(sizeInUsdRaw)
    expect(ratio).toBeCloseTo(0.25, 6)
  })

  it("estimates proportional PnL and remaining exposure for partial and full closes", () => {
    const position = {
      sizeUsd: 40_000,
      collateralUsd: 4_000,
      pnl: 1_200,
      pnlAfterFees: 1_000,
      pnlPercent: 25,
      fundingFeeUsd: 200,
    }

    const half = estimateClosePreview(position, 20_000, false)
    expect(half.hasValidSize).toBe(true)
    expect(half.closeRatio).toBe(0.5)
    expect(half.estimatedPnlUsd).toBe(500)
    expect(half.remainingSizeUsd).toBe(20_000)
    expect(half.remainingCollateralUsd).toBe(2_000)

    const full = estimateClosePreview(position, 40_000, true)
    expect(full.hasValidSize).toBe(true)
    expect(full.estimatedPnlUsd).toBe(1_000)
    expect(full.remainingSizeUsd).toBe(0)
    expect(full.remainingCollateralUsd).toBe(0)

    const invalid = estimateClosePreview(position, 0, false)
    expect(invalid.hasValidSize).toBe(false)
    expect(invalid.remainingSizeUsd).toBe(40_000)
  })

  it("rejects closing when mark price is unavailable", () => {
    expect(
      validateClosePayload(
        { isFull: true, sizeDeltaUsd: 10_000 },
        {
          sizeUsd: 10_000,
          sizeInUsdRaw: 10_000n,
          collateralAmount: 1_000,
          collateralUsd: 1_000,
          markPrice: 0,
        },
      ),
    ).toMatch(/mark price unavailable/i)
  })
})
