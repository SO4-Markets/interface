import { useQuery } from "@tanstack/react-query"
import { useWalletStore } from "../store/wallet-store"
import { NETWORK } from "@/app/config/network"
import { queryKeys } from "@/shared/lib/query-keys"
import { queryPolicy } from "@/shared/lib/query-policies"

type HorizonBalance = {
  asset_type: "native" | "credit_alphanum4" | "credit_alphanum12"
  asset_code?: string
  balance: string
}

async function fetchTokenBalances(
  address: string,
  signal?: AbortSignal,
): Promise<Record<string, number>> {
  const res = await fetch(`${NETWORK.horizonUrl}/accounts/${address}`, { signal })
  if (!res.ok) throw new Error(`Horizon error ${res.status}`)
  const data = await res.json()

  const result: Record<string, number> = {}
  for (const entry of data.balances as Array<HorizonBalance>) {
    const symbol = entry.asset_type === "native" ? "XLM" : (entry.asset_code ?? "")
    if (symbol) result[symbol] = parseFloat(entry.balance)
  }
  return result
}

export function useTokenBalances() {
  const { address, status } = useWalletStore()

  return useQuery({
    queryKey: queryKeys.wallet.tokenBalances(address ?? ""),
    queryFn: ({ signal }) => fetchTokenBalances(address!, signal),
    enabled: !!address && status === "connected",
    ...queryPolicy("balances"),
  })
}
