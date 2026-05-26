import { create } from "zustand"
import { persist } from "zustand/middleware"

type WalletStatus = "disconnected" | "connecting" | "connected" | "error"
type Network = "testnet" | "mainnet"

type WalletStore = {
  address: string | null
  network: Network
  walletId: string | null
  status: WalletStatus
  setConnected: (address: string, walletId: string) => void
  setDisconnected: () => void
  setStatus: (status: WalletStatus) => void
}

const DEFAULT_NETWORK: Network =
  (import.meta.env.VITE_NETWORK as Network) === "mainnet" ? "mainnet" : "testnet"

export const useWalletStore = create<WalletStore>()(
  persist(
    (set) => ({
      address: null,
      network: DEFAULT_NETWORK,
      walletId: null,
      status: "disconnected",

      setConnected: (address, walletId) =>
        set({ address, walletId, status: "connected" }),

      setDisconnected: () =>
        set({ address: null, walletId: null, status: "disconnected" }),

      setStatus: (status) => set({ status }),
    }),
    {
      name: "so4-wallet",
      partialize: (state) => ({
        address: state.address,
        walletId: state.walletId,
        network: state.network,
      }),
    },
  ),
)
