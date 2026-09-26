import { useQuery } from "@tanstack/react-query"
import { useWallet } from "@/app/providers"
import { NETWORK } from "@/app/config/network"
import { queryKeys } from "@/shared/lib/query-keys"
import { queryPolicy } from "@/shared/lib/query-policies"

async function fetchXlmBalance(address: string, signal?: AbortSignal): Promise<number> {
  const res = await fetch(`${NETWORK.horizonUrl}/accounts/${address}`, { signal })
  if (!res.ok) throw new Error(`Horizon error ${res.status}`)
  const data = await res.json()
  const native = data.balances.find(
    (b: { asset_type: string }) => b.asset_type === "native",
  )
  return native ? parseFloat(native.balance) : 0
}

export function useBalance() {
  const { address } = useWallet()

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.wallet.balance(address ?? ""),
    queryFn: ({ signal }) => fetchXlmBalance(address as string, signal),
    enabled: !!address,
    ...queryPolicy("balances"),
  })

  if (!address) return null

  return { xlm: data ?? 0, isLoading, error }
}
