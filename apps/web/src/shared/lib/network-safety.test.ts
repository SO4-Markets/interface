import { afterEach, describe, expect, it } from "vitest"
import { assertOnlineForTransaction, OFFLINE_TRANSACTION_MESSAGE } from "./network-safety"

function setOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: online })
}

describe("assertOnlineForTransaction", () => {
  afterEach(() => setOnline(true))

  it("allows transaction preparation while online", () => {
    setOnline(true)
    expect(() => assertOnlineForTransaction()).not.toThrow()
  })

  it("blocks wallet signing and broadcast while offline", () => {
    setOnline(false)
    expect(() => assertOnlineForTransaction()).toThrow(OFFLINE_TRANSACTION_MESSAGE)
  })
})