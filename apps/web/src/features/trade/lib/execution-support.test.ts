import { describe, expect, it } from "vitest"
import { validateExecutionRequest } from "./execution-support"

describe("execution support gates", () => {
  it("allows an ordinary order with no unsupported controls", () => {
    expect(validateExecutionRequest({})).toEqual({ valid: true })
  })

  it("rejects reduce-only before signing when the gateway does not enforce it", () => {
    const result = validateExecutionRequest({ reduceOnly: true })
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toMatch(/reduce-only/i)
  })

  it("rejects attached TP/SL orders instead of claiming they were created", () => {
    const result = validateExecutionRequest({
      attachedOrders: [{ type: "takeProfit", triggerPrice: "105", sizePct: 100 }],
    })
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toMatch(/take-profit/i)
  })
})
