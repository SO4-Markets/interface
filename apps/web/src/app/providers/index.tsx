import { createContext, useCallback, useContext, useEffect, useRef } from "react"
import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit/sdk"
import { defaultModules } from "@creit.tech/stellar-wallets-kit/modules/utils"
import { KitEventType, Networks } from "@creit.tech/stellar-wallets-kit/types"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import { NETWORK } from "@/app/config/network"

const kitNetwork =
  NETWORK.name === "mainnet" ? Networks.PUBLIC : Networks.TESTNET

StellarWalletsKit.init({
  modules: defaultModules(),
  network: kitNetwork,
})

export type WalletStatus = "disconnected" | "connecting" | "connected" | "error"

export type WalletContextValue = {
  address: string | null
  status: WalletStatus
  connect: () => Promise<void>
  disconnect: () => Promise<void>
}

const WalletContext = createContext<WalletContextValue>({
  address: null,
  status: "disconnected",
  connect: async () => {},
  disconnect: async () => {},
})

export function useWallet(): WalletContextValue {
  return useContext(WalletContext)
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { address, status, setConnected, setDisconnected, setStatus } = useWalletStore()
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    const unsub = StellarWalletsKit.on(KitEventType.STATE_UPDATED, (event) => {
      if (!mountedRef.current) return
      if (event.payload.address) {
        setConnected(event.payload.address, "kit")
      }
    })
    return unsub
  }, [setConnected])

  useEffect(() => {
    const unsub = StellarWalletsKit.on(KitEventType.DISCONNECT, () => {
      if (mountedRef.current) setDisconnected()
    })
    return unsub
  }, [setDisconnected])

  const connect = useCallback(async () => {
    setStatus("connecting")
    try {
      const { address: addr } = await StellarWalletsKit.authModal()
      if (mountedRef.current) setConnected(addr, "kit")
    } catch {
      if (mountedRef.current) setStatus("disconnected")
    }
  }, [setConnected, setStatus])

  const disconnect = useCallback(async () => {
    await StellarWalletsKit.disconnect()
    if (mountedRef.current) setDisconnected()
  }, [setDisconnected])

  return (
    <WalletContext.Provider value={{ address, status, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  )
}
