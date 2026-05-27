import { useQuery } from "@tanstack/react-query"
import { GLV_VAULTS, GM_POOLS } from "../data/pools"
import { useWalletStore } from "@/features/wallet/store/wallet-store"

export type GLVPoolAllocation = {
  poolId: string
  allocationPct: number
}

export type GLVVaultData = {
  apr: number
  tvlUsd: number
  underlyingPoolAllocations: Array<GLVPoolAllocation>
  userGlvBalance: bigint
}

const BALANCE_DECIMALS = 7

function estimateWalletBalance(address: string | null, glvAddress: string): bigint {
  if (!address) return 0n

  const seed = Array.from(`${address}:${glvAddress}`).reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  )

  return BigInt(seed % 100) * 10n ** BigInt(BALANCE_DECIMALS)
}

export function useGLVVaultData(glvAddress: string) {
  const { address, status } = useWalletStore()

  return useQuery<GLVVaultData>({
    queryKey: ["earn", "glvVaultData", glvAddress, address],
    queryFn: async (): Promise<GLVVaultData> => {
      const vault = GLV_VAULTS.find((entry) => entry.id === glvAddress)

      if (!vault) {
        return {
          apr: 0,
          tvlUsd: 0,
          underlyingPoolAllocations: [],
          userGlvBalance: 0n,
        }
      }

      const underlyingPools = vault.underlyingPools.flatMap((poolId) => {
        const pool = GM_POOLS.find((entry) => entry.id === poolId)
        return pool ? [pool] : []
      })
      const totalTvl = underlyingPools.reduce((sum, pool) => sum + pool.tvlUsd, 0)

      return {
        apr: vault.apy,
        tvlUsd: vault.tvlUsd,
        underlyingPoolAllocations: underlyingPools.map((pool) => ({
          poolId: pool.id,
          allocationPct: totalTvl > 0 ? (pool.tvlUsd / totalTvl) * 100 : 0,
        })),
        userGlvBalance: estimateWalletBalance(
          status === "connected" ? address : null,
          vault.id,
        ),
      }
    },
    enabled: !!glvAddress,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}
