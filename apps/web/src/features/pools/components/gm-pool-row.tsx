import { Skeleton } from "@workspace/ui/components/skeleton"
import { usePoolRowData } from "../hooks/use-pool-row-data"
import {
  getComposition,
  getEstimatedApy,
  getPoolTvlUsd,
  rawToDisplay,
} from "../lib/pool-math"
import { PoolActions } from "./pool-actions"
import { PoolCompositionBar } from "./pool-composition-bar"
import type { PoolMarketConfig } from "../data/markets"
import { TokenIcon } from "@/shared/components/TokenIcon"
import { formatPct, formatToken, formatUsd } from "@/shared/lib/format"
import { formatSorobanAmount } from "@/shared/lib/bignum"
import { useWalletStore } from "@/features/wallet/store/wallet-store"

type GmPoolRowProps = {
  market: PoolMarketConfig
  variant: "desktop" | "mobile"
}

function PoolIdentity({ market }: { market: PoolMarketConfig }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex shrink-0 -space-x-2">
        <TokenIcon symbol={market.longSymbol.replace(/^T/, "")} size={30} />
        <TokenIcon symbol={market.shortSymbol.replace(/^T/, "")} size={30} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{market.label}</p>
        <p className="truncate text-xs text-muted-foreground">{market.displayName}</p>
      </div>
    </div>
  )
}

export function GmPoolRow({ market, variant }: GmPoolRowProps) {
  const address = useWalletStore((state) => state.address)
  const isConnected = useWalletStore((state) => state.status === "connected")
  const { data, isLoading } = usePoolRowData(market)
  const poolValue = data?.poolValue
  const composition = getComposition(poolValue)
  const tvlUsd = getPoolTvlUsd(poolValue)
  const apy = getEstimatedApy(poolValue)
  const openInterestUsd =
    rawToDisplay(data?.openInterest?.long) + rawToDisplay(data?.openInterest?.short)
  const funding = rawToDisplay(data?.fundingInfo?.fundingFactorPerSecond)
  const userGmBalance = data?.userGmBalance ?? 0n
  const hasUserGm = userGmBalance > 0n
  const hasFailures = (data?.failures.length ?? 0) > 0

  if (variant === "mobile") {
    return (
      <article className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <PoolIdentity market={market} />
          {isLoading ? <Skeleton className="h-5 w-20" /> : <p className="text-sm">{formatUsd(tvlUsd)}</p>}
        </div>
        <div className="mt-4">
          <PoolCompositionBar
            longPct={composition.longPct}
            shortPct={composition.shortPct}
            longSymbol={market.longSymbol}
            shortSymbol={market.shortSymbol}
          />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
          <div>
            <dt className="text-muted-foreground">Open interest</dt>
            <dd className="mt-1 text-foreground">{formatUsd(openInterestUsd)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">APY</dt>
            <dd className="mt-1 text-foreground">{apy == null ? "Est. pending" : `${formatPct(apy, { sign: false })} est.`}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Your GM</dt>
            <dd className="mt-1 text-foreground">{formatToken(rawToDisplay(userGmBalance), "GM", { decimals: 4 })}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Funding</dt>
            <dd className="mt-1 text-foreground">{funding === 0 ? "—" : formatPct(funding, { decimals: 4 })}</dd>
          </div>
        </dl>
        {hasFailures ? (
          <p className="mt-3 text-[12px] text-yellow-600 dark:text-yellow-400">
            Some live reads are unavailable.
          </p>
        ) : null}
        <div className="mt-4">
          <PoolActions
            hasWallet={!!address && isConnected}
            hasUserGm={hasUserGm}
            account={address}
            market={market}
            userGmBalance={userGmBalance}
          />
        </div>
      </article>
    )
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-5 py-4">
        <PoolIdentity market={market} />
      </td>
      <td className="px-5 py-4 text-right font-mono text-sm">
        {isLoading ? <Skeleton className="ml-auto h-4 w-20" /> : formatUsd(tvlUsd)}
      </td>
      <td className="px-5 py-4">
        <PoolCompositionBar
          longPct={composition.longPct}
          shortPct={composition.shortPct}
          longSymbol={market.longSymbol}
          shortSymbol={market.shortSymbol}
        />
      </td>
      <td className="px-5 py-4 text-right font-mono text-sm">{formatUsd(openInterestUsd)}</td>
      <td className="px-5 py-4 text-right font-mono text-sm">
        {funding === 0 ? "—" : formatPct(funding, { decimals: 4 })}
      </td>
      <td className="px-5 py-4 text-right font-mono text-sm">
        {apy == null ? "Est. pending" : `${formatPct(apy, { sign: false })} est.`}
      </td>
      <td className="px-5 py-4 text-right font-mono text-sm">
        {formatToken(Number(formatSorobanAmount(userGmBalance, 7, 4)), "GM", { decimals: 4 })}
      </td>
      <td className="px-5 py-4 text-right">
        <PoolActions
          hasWallet={!!address && isConnected}
          hasUserGm={hasUserGm}
          account={address}
          market={market}
          userGmBalance={userGmBalance}
        />
        {hasFailures ? (
          <p className="mt-2 text-right text-[11px] text-yellow-600 dark:text-yellow-400">
            Partial data
          </p>
        ) : null}
      </td>
    </tr>
  )
}
