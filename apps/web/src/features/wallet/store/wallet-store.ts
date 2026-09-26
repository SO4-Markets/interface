import { create } from "zustand"
import { persist } from "zustand/middleware"

type WalletStatus = "disconnected" | "connecting" | "connected" | "error"
type Network = string | null

export const MAX_PENDING_TX_AGE_MS = 15 * 60 * 1000 // 15 minutes

type WalletStore = {
  address: string | null
  network: Network
  pendingTransactionXdr: string | null
  pendingTransactionTimestamp: number | null
  walletId: string | null
  status: WalletStatus
  setConnected: (address: string, walletId: string) => void
  setDisconnected: () => void
  setPendingTransactionXdr: (xdr: string | null) => void
  setStatus: (status: WalletStatus) => void
}

const DEFAULT_NETWORK: Network =
  (import.meta.env.VITE_NETWORK as string) === "mainnet" ? "mainnet" : "testnet"

export const useWalletStore = create<WalletStore>()(
  persist(
    (set) => ({
      address: null,
      network: DEFAULT_NETWORK,
      pendingTransactionXdr: null,
      pendingTransactionTimestamp: null,
      walletId: null,
      status: "disconnected",

      setConnected: (address, walletId) =>
        set({ address, walletId, status: "connected" }),

      setDisconnected: () =>
        set({ address: null, walletId: null, status: "disconnected" }),

      setPendingTransactionXdr: (pendingTransactionXdr) =>
        set({
          pendingTransactionXdr,
          pendingTransactionTimestamp: pendingTransactionXdr ? Date.now() : null,
        }),

      setStatus: (status) => set({ status }),
    }),
    {
      name: "so4-wallet",
      version: 1,
      partialize: (state) => ({
        address: state.address,
        walletId: state.walletId,
        network: state.network,
        pendingTransactionXdr: state.pendingTransactionXdr,
        pendingTransactionTimestamp: state.pendingTransactionTimestamp,
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<WalletStore>) || {}
        let pendingXdr = persisted.pendingTransactionXdr ?? null
        const txTimestamp = persisted.pendingTransactionTimestamp ?? null

        // Freshness check: discard stale pending transaction XDR older than 15 minutes
        if (pendingXdr && txTimestamp && Date.now() - txTimestamp > MAX_PENDING_TX_AGE_MS) {
          pendingXdr = null
        }

        return {
          ...currentState,
          ...persisted,
          pendingTransactionXdr: pendingXdr,
          pendingTransactionTimestamp: pendingXdr ? txTimestamp : null,
        }
      },
    },
  ),
)
