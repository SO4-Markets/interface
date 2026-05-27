import { createContext, useContext, useMemo, type ReactNode } from "react"
import { useWalletStore } from "../store/wallet-store"

type WalletStatus = "disconnected" | "connecting" | "connected" | "error"

export type WalletKit = {
  setWallet: (walletId: string) => Promise<void>
  getAddress: () => Promise<string | null>
  disconnect: () => Promise<void>
  signTransaction: (xdr: string) => Promise<string>
}

interface WalletContextValue {
  walletKit: WalletKit
  address: string | null
  walletId: string | null
  status: WalletStatus
  connect: (walletId: string) => Promise<void>
  disconnect: () => void
  signTransaction: (xdr: string) => Promise<string>
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined)

export function WalletProvider({
  walletKit,
  children,
}: {
  walletKit: WalletKit
  children: ReactNode
}) {
  const { address, walletId, status, setConnected, setDisconnected, setStatus } = useWalletStore()

  const connect = async (walletId: string) => {
    setStatus("connecting")

    try {
      await walletKit.setWallet(walletId)
      const connectedAddress = await walletKit.getAddress()

      if (!connectedAddress) {
        setStatus("error")
        throw new Error("Failed to retrieve wallet address")
      }

      setConnected(connectedAddress, walletId)
    } catch (error) {
      setStatus("error")
      throw error instanceof Error ? error : new Error("Wallet connection failed")
    }
  }

  const disconnect = () => {
    void walletKit.disconnect()
    setDisconnected()
  }

  const signTransaction = async (xdr: string) => walletKit.signTransaction(xdr)

  const contextValue = useMemo(
    () => ({ walletKit, address, walletId, status, connect, disconnect, signTransaction }),
    [walletKit, address, walletId, status],
  )

  return <WalletContext.Provider value={contextValue}>{children}</WalletContext.Provider>
}

export function useWalletContext() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error("useWallet must be used within WalletProvider")
  return ctx
}
