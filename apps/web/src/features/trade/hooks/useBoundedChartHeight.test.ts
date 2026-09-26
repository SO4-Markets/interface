import { describe, expect, it } from "vitest"
import { renderHook } from "@testing-library/react"
import { CHART_ROW_HEIGHT_MAX, CHART_ROW_HEIGHT_MIN } from "../store/layout-preferences-store"
import { useBoundedChartHeight } from "./useBoundedChartHeight"

function refWithHeight(height: number) {
  const el = document.createElement("div")
  el.getBoundingClientRect = () =>
    ({ height, width: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} })
  return { current: el }
}

describe("useBoundedChartHeight", () => {
  it("returns the requested height clamped to the global bounds when it fits", () => {
    const { result } = renderHook(() => useBoundedChartHeight(refWithHeight(1200), 500))
    expect(result.current).toBe(500)
  })

  it("clamps down when the container is too short to fit the requested height plus the sibling minimum", () => {
    // 300px container, 160px reserved for the sibling panel -> at most 240px (the floor) for the chart.
    const { result } = renderHook(() => useBoundedChartHeight(refWithHeight(300), 700))
    expect(result.current).toBe(CHART_ROW_HEIGHT_MIN)
  })

  it("never exceeds the configured maximum even on very tall containers", () => {
    const { result } = renderHook(() => useBoundedChartHeight(refWithHeight(5000), 5000))
    expect(result.current).toBe(CHART_ROW_HEIGHT_MAX)
  })
})
