import { beforeEach, describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { useWalletStore } from "../store/wallet-store"
import { NetworkHealthIndicator } from "./NetworkHealthIndicator"

describe("NetworkHealthIndicator", () => {
  beforeEach(() => {
    useWalletStore.setState({ address: null, walletId: null, network: "testnet", status: "disconnected" })
  })

  it("announces disconnected state with a clear next step", () => {
    render(<NetworkHealthIndicator />)
    expect(screen.getByRole("status", { name: /Wallet disconnected\. Connect a wallet/i })).toBeInTheDocument()
    expect(screen.getByText("Wallet disconnected")).toBeInTheDocument()
  })

  it("announces a recoverable wallet connection failure without implying transaction status", () => {
    useWalletStore.setState({ status: "error" })
    render(<NetworkHealthIndicator />)
    const status = screen.getByRole("status", { name: /Wallet connection failed\. Reconnect your wallet/i })
    expect(status).toHaveTextContent("Reconnect wallet")
    expect(status).not.toHaveTextContent(/submitted|confirmed|accepted|executed/i)
  })
})
