import { useEffect, useState } from "react"
import { useWalletStore } from "../store/wallet-store"
import { useNetwork } from "./useNetwork"

export type NetworkHealthStatus = "healthy" | "offline" | "mismatch" | "disconnected" | "connecting" | "error"

export function useNetworkHealth() {
  const { mismatch, displayLabel } = useNetwork()
  const walletStatus = useWalletStore((state) => state.status)
  // Start "online" on both server and first client render so hydration
  // matches, then read the real value after mount.
  const [online, setOnline] = useState(true)

  useEffect(() => {
    setOnline(navigator.onLine)
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  const status: NetworkHealthStatus = !online
    ? "offline"
    : walletStatus === "connecting"
      ? "connecting"
      : walletStatus === "error"
        ? "error"
        : walletStatus !== "connected"
          ? "disconnected"
          : mismatch
            ? "mismatch"
            : "healthy"

  const message = status === "offline"
    ? "Browser offline. Check your internet connection."
    : status === "connecting"
      ? "Connecting wallet. Wait for the connection to finish."
      : status === "error"
        ? "Wallet connection failed. Reconnect your wallet to try again."
        : status === "mismatch"
          ? `Wallet network (${displayLabel}) does not match the selected network`
          : status === "disconnected"
            ? "Wallet disconnected. Connect a wallet to check its network."
            : `Wallet connected to ${displayLabel}. This does not confirm any transaction.`

  return { status, message, online, displayLabel, isHealthy: status === "healthy" }
}

