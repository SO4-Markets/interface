import { beforeEach, describe, expect, it } from "vitest"
import { useWalletStore } from "./wallet-store"

describe("useWalletStore", () => {
  beforeEach(() => {
    useWalletStore.setState({
      address: null,
      network: "testnet",
      pendingTransactionXdr: null,
      walletId: null,
      status: "disconnected",
    })
  })

  describe("Initial State", () => {
    it("should have correct initial state", () => {
      const state = useWalletStore.getState()

      expect(state.address).toBeNull()
      expect(state.walletId).toBeNull()
      expect(state.status).toBe("disconnected")
      expect(state.pendingTransactionXdr).toBeNull()
      expect(state.network).toBe("testnet")
    })

    it("should have all required action methods", () => {
      const state = useWalletStore.getState()

      expect(typeof state.setConnected).toBe("function")
      expect(typeof state.setDisconnected).toBe("function")
      expect(typeof state.setPendingTransactionXdr).toBe("function")
      expect(typeof state.setStatus).toBe("function")
    })
  })

  describe("Connect Transitions", () => {
    it("should transition from disconnected to connected", () => {
      const { getState } = useWalletStore
      const { setConnected} = getState()

      setConnected("GCZXVVCZULC5NZ2V23MZWCABDGVH42DXSBVVMVX34OXQBAWIB7CFZZJ", "freighter")

      const state = getState()
      expect(state.address).toBe("GCZXVVCZULC5NZ2V23MZWCABDGVH42DXSBVVMVX34OXQBAWIB7CFZZJ")
      expect(state.walletId).toBe("freighter")
      expect(state.status).toBe("connected")
    })

    it("should set address and walletId together on connect", () => {
      const address = "GCZXVVCZULC5NZ2V23MZWCABDGVH42DXSBVVMVX34OXQBAWIB7CFZZJ"
      const walletId = "stellar-expert"
      const { getState } = useWalletStore
      const { setConnected} = getState()

      setConnected(address, walletId)

      const state = getState()
      expect(state.address).toBe(address)
      expect(state.walletId).toBe(walletId)
    })

    it("should preserve pendingTransactionXdr on connect", () => {
      const { getState } = useWalletStore
      const { setPendingTransactionXdr, setConnected} = getState()
      const xdr = "AAAAAgAAAACZf3bw..."

      setPendingTransactionXdr(xdr)
      setConnected("GCZXVVCZULC5NZ2V23MZWCABDGVH42DXSBVVMVX34OXQBAWIB7CFZZJ", "freighter")

      const state = getState()
      expect(state.pendingTransactionXdr).toBe(xdr)
      expect(state.address).toBe("GCZXVVCZULC5NZ2V23MZWCABDGVH42DXSBVVMVX34OXQBAWIB7CFZZJ")
    })

    it("should handle multiple connect calls (overwrite previous)", () => {
      const { getState } = useWalletStore
      const { setConnected} = getState()

      setConnected("GCZXVVCZULC5NZ2V23MZWCABDGVH42DXSBVVMVX34OXQBAWIB7CFZZJ", "freighter")
      setConnected("GBBD47UZQ2YNRGESRV37TJZWQ6HC76ZK34CSXVGBTCVRXGT7GBNXVQ34", "ledger")

      const state = getState()
      expect(state.address).toBe("GBBD47UZQ2YNRGESRV37TJZWQ6HC76ZK34CSXVGBTCVRXGT7GBNXVQ34")
      expect(state.walletId).toBe("ledger")
      expect(state.status).toBe("connected")
    })
  })

  describe("Disconnect Transitions", () => {
    it("should transition from connected to disconnected", () => {
      const { getState } = useWalletStore
      const { setConnected, setDisconnected} = getState()

      setConnected("GCZXVVCZULC5NZ2V23MZWCABDGVH42DXSBVVMVX34OXQBAWIB7CFZZJ", "freighter")
      expect(getState().status).toBe("connected")

      setDisconnected()

      const state = getState()
      expect(state.address).toBeNull()
      expect(state.walletId).toBeNull()
      expect(state.status).toBe("disconnected")
    })

    it("should clear address and walletId on disconnect", () => {
      const { getState } = useWalletStore
      const { setConnected, setDisconnected} = getState()

      setConnected("GCZXVVCZULC5NZ2V23MZWCABDGVH42DXSBVVMVX34OXQBAWIB7CFZZJ", "freighter")
      setDisconnected()

      const state = getState()
      expect(state.address).toBeNull()
      expect(state.walletId).toBeNull()
    })

    it("should preserve pendingTransactionXdr on disconnect", () => {
      const { getState } = useWalletStore
      const { setConnected, setPendingTransactionXdr, setDisconnected} = getState()
      const xdr = "AAAAAgAAAACZf3bw..."

      setConnected("GCZXVVCZULC5NZ2V23MZWCABDGVH42DXSBVVMVX34OXQBAWIB7CFZZJ", "freighter")
      setPendingTransactionXdr(xdr)
      setDisconnected()

      const state = getState()
      expect(state.pendingTransactionXdr).toBe(xdr)
      expect(state.address).toBeNull()
      expect(state.status).toBe("disconnected")
    })

    it("should handle disconnect when already disconnected", () => {
      const { getState } = useWalletStore
      const { setDisconnected} = getState()

      setDisconnected()

      const state = getState()
      expect(state.address).toBeNull()
      expect(state.walletId).toBeNull()
      expect(state.status).toBe("disconnected")
    })
  })

  describe("Status Transitions", () => {
    it("should transition to connecting status", () => {
      const { getState } = useWalletStore
      const { setStatus} = getState()

      setStatus("connecting")

      expect(getState().status).toBe("connecting")
    })

    it("should transition to error status", () => {
      const { getState } = useWalletStore
      const { setStatus} = getState()

      setStatus("error")

      expect(getState().status).toBe("error")
    })

    it("should transition through all status states", () => {
      const { getState } = useWalletStore
      const { setStatus} = getState()
      const statuses: Array<"disconnected" | "connecting" | "connected" | "error"> = [
        "disconnected",
        "connecting",
        "connected",
        "error",
        "disconnected",
      ]

      for (const status of statuses) {
        setStatus(status)
        expect(getState().status).toBe(status)
      }
    })

    it("should handle status change while connected", () => {
      const { getState } = useWalletStore
      const { setConnected, setStatus} = getState()

      setConnected("GCZXVVCZULC5NZ2V23MZWCABDGVH42DXSBVVMVX34OXQBAWIB7CFZZJ", "freighter")
      setStatus("error")

      const state = getState()
      expect(state.status).toBe("error")
      expect(state.address).toBe("GCZXVVCZULC5NZ2V23MZWCABDGVH42DXSBVVMVX34OXQBAWIB7CFZZJ")
    })
  })

  describe("PendingTransactionXdr Transitions", () => {
    it("should set pending transaction XDR", () => {
      const { getState } = useWalletStore
      const { setPendingTransactionXdr} = getState()
      const xdr = "AAAAAgAAAACZf3bw..."

      setPendingTransactionXdr(xdr)

      expect(getState().pendingTransactionXdr).toBe(xdr)
    })

    it("should clear pending transaction XDR", () => {
      const { getState } = useWalletStore
      const { setPendingTransactionXdr} = getState()
      const xdr = "AAAAAgAAAACZf3bw..."

      setPendingTransactionXdr(xdr)
      expect(getState().pendingTransactionXdr).toBe(xdr)

      setPendingTransactionXdr(null)
      expect(getState().pendingTransactionXdr).toBeNull()
    })

    it("should update pending transaction XDR multiple times", () => {
      const { getState } = useWalletStore
      const { setPendingTransactionXdr} = getState()

      setPendingTransactionXdr("AAAAAgAAAACZf3bw...")
      expect(getState().pendingTransactionXdr).toBe("AAAAAgAAAACZf3bw...")

      setPendingTransactionXdr("AAAABgAAAACDf5dw...")
      expect(getState().pendingTransactionXdr).toBe("AAAABgAAAACDf5dw...")

      setPendingTransactionXdr(null)
      expect(getState().pendingTransactionXdr).toBeNull()
    })

    it("should preserve wallet connection when setting XDR", () => {
      const { getState } = useWalletStore
      const { setConnected, setPendingTransactionXdr} = getState()
      const xdr = "AAAAAgAAAACZf3bw..."

      setConnected("GCZXVVCZULC5NZ2V23MZWCABDGVH42DXSBVVMVX34OXQBAWIB7CFZZJ", "freighter")
      setPendingTransactionXdr(xdr)

      const state = getState()
      expect(state.address).toBe("GCZXVVCZULC5NZ2V23MZWCABDGVH42DXSBVVMVX34OXQBAWIB7CFZZJ")
      expect(state.walletId).toBe("freighter")
      expect(state.status).toBe("connected")
      expect(state.pendingTransactionXdr).toBe(xdr)
    })
  })

  describe("Complex State Transitions", () => {
    it("should handle connecting -> connected -> error -> disconnected flow", () => {
      const { getState } = useWalletStore
      const { setStatus, setConnected, setDisconnected} = getState()

      // Start connecting
      setStatus("connecting")
      expect(getState().status).toBe("connecting")

      // Move to connected
      setConnected("GCZXVVCZULC5NZ2V23MZWCABDGVH42DXSBVVMVX34OXQBAWIB7CFZZJ", "freighter")
      expect(getState().status).toBe("connected")
      expect(getState().address).not.toBeNull()

      // Error occurs
      setStatus("error")
      expect(getState().status).toBe("error")
      expect(getState().address).toBe("GCZXVVCZULC5NZ2V23MZWCABDGVH42DXSBVVMVX34OXQBAWIB7CFZZJ")

      // Disconnect
      setDisconnected()
      expect(getState().status).toBe("disconnected")
      expect(getState().address).toBeNull()
      expect(getState().walletId).toBeNull()
    })

    it("should handle transaction flow: connect -> set XDR -> disconnect", () => {
      const { getState } = useWalletStore
      const { setConnected, setPendingTransactionXdr, setDisconnected} = getState()
      const address = "GCZXVVCZULC5NZ2V23MZWCABDGVH42DXSBVVMVX34OXQBAWIB7CFZZJ"
      const walletId = "freighter"
      const xdr = "AAAAAgAAAACZf3bw..."

      // Connect
      setConnected(address, walletId)
      expect(getState().address).toBe(address)

      // Set pending transaction
      setPendingTransactionXdr(xdr)
      expect(getState().pendingTransactionXdr).toBe(xdr)

      // User disconnects (XDR persists for potential retry)
      setDisconnected()
      const state = getState()
      expect(state.address).toBeNull()
      expect(state.walletId).toBeNull()
      expect(state.pendingTransactionXdr).toBe(xdr)
    })

    it("should handle reconnection preserving pending transaction", () => {
      const { getState } = useWalletStore
      const { setConnected, setPendingTransactionXdr, setDisconnected} = getState()
      const xdr = "AAAAAgAAAACZf3bw..."

      // Initial connection
      setConnected("GCZXVVCZULC5NZ2V23MZWCABDGVH42DXSBVVMVX34OXQBAWIB7CFZZJ", "freighter")
      setPendingTransactionXdr(xdr)

      // Disconnect
      setDisconnected()
      expect(getState().pendingTransactionXdr).toBe(xdr)

      // Reconnect with different wallet
      setConnected("GBBD47UZQ2YNRGESRV37TJZWQ6HC76ZK34CSXVGBTCVRXGT7GBNXVQ34", "ledger")

      const state = getState()
      expect(state.address).toBe("GBBD47UZQ2YNRGESRV37TJZWQ6HC76ZK34CSXVGBTCVRXGT7GBNXVQ34")
      expect(state.walletId).toBe("ledger")
      expect(state.pendingTransactionXdr).toBe(xdr)
    })

    it("should reset all connection state independently", () => {
      const { getState } = useWalletStore
      const { setConnected, setPendingTransactionXdr} = getState()

      // Build up state
      setConnected("GCZXVVCZULC5NZ2V23MZWCABDGVH42DXSBVVMVX34OXQBAWIB7CFZZJ", "freighter")
      setPendingTransactionXdr("AAAAAgAAAACZf3bw...")

      // Reset each field
      useWalletStore.setState({
        address: null,
        walletId: null,
        status: "disconnected",
        pendingTransactionXdr: null,
      })

      const state = getState()
      expect(state.address).toBeNull()
      expect(state.walletId).toBeNull()
      expect(state.status).toBe("disconnected")
      expect(state.pendingTransactionXdr).toBeNull()
    })
  })

  describe("State Isolation & No Leakage", () => {
    it("should not leak state between independent operations", () => {
      const { getState } = useWalletStore
      const { setConnected} = getState()

      setConnected("GCZXVVCZULC5NZ2V23MZWCABDGVH42DXSBVVMVX34OXQBAWIB7CFZZJ", "freighter")
      const state1 = getState()

      // Reset in beforeEach happens
      // This simulates what happens between tests
      useWalletStore.setState({
        address: null,
        network: "testnet",
        pendingTransactionXdr: null,
        walletId: null,
        status: "disconnected",
      })

      const state2 = getState()
      expect(state1.address).not.toBeNull()
      expect(state2.address).toBeNull()
    })

    it("test A: should have clean state", () => {
      const state = useWalletStore.getState()
      expect(state.address).toBeNull()

      useWalletStore.getState().setConnected("ADDR1", "wallet1")
      expect(useWalletStore.getState().address).toBe("ADDR1")
    })

    it("test B: should not have state from test A", () => {
      // beforeEach resets state
      const state = useWalletStore.getState()
      expect(state.address).toBeNull()
      expect(state.walletId).toBeNull()
    })
  })

  describe("Network State", () => {
    it("should preserve network state", () => {
      const state = useWalletStore.getState()
      expect(state.network).toBe("testnet")
    })

    it("should maintain network regardless of wallet changes", () => {
      const { getState } = useWalletStore
      const { setConnected, setDisconnected} = getState()

      setConnected("GCZXVVCZULC5NZ2V23MZWCABDGVH42DXSBVVMVX34OXQBAWIB7CFZZJ", "freighter")
      expect(getState().network).toBe("testnet")

      setDisconnected()
      expect(getState().network).toBe("testnet")
    })
  })
})
