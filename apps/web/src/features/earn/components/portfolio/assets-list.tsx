import { useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useUserGlvPositions, useUserGmPositions, useUserSO4Stats } from "../../hooks/use-earn-data"
import { unstakeSO4, withdrawGLV, withdrawGM } from "../../lib/earn"
import { formatPct, formatUsd } from "@/shared/lib/format"



function WalletEmptyIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-muted-foreground/50"
    >
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <circle cx="16" cy="15" r="1" fill="currentColor" stroke="none" />
      <path d="M6 3 2 7" opacity="0.4" />
      <path d="M18 3l4 4" opacity="0.4" />
    </svg>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/40">
        <WalletEmptyIcon />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground/80">You have no deposits</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Start earning by depositing into a pool
        </p>
        <a href="#browse-pools" className="text-xs text-primary hover:text-primary/80 font-medium mt-2 inline-block">
          Browse pools →
        </a>
      </div>
    </div>
  )
}

function LoadingRows() {
  return (
    <div className="space-y-px p-1">
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="ml-auto h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-14" />
        </div>
      ))}
    </div>
  )
}

const KIND_BADGE: Record<string, string> = {
  Staking: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  GM: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  GLV: "bg-teal-500/10 text-teal-400 border-teal-500/20",
}

function TypeBadge({ kind }: { kind: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-medium",
        KIND_BADGE[kind] ?? "bg-muted text-muted-foreground border-border",
      )}
    >
      {kind}
    </span>
  )
}

export function AssetsList() {
  const { data: gmPositions = [], isLoading: gmLoading } = useUserGmPositions()
  const { data: glvPositions = [], isLoading: glvLoading } = useUserGlvPositions()
  const { data: so4Stats, isLoading: so4Loading } = useUserSO4Stats()
  const [pending, setPending] = useState<string | null>(null)

  const isLoading = gmLoading || glvLoading || so4Loading
  const hasSO4 = (so4Stats?.stakedAmount ?? 0) > 0
  const hasAny = hasSO4 || gmPositions.length > 0 || glvPositions.length > 0

  async function runAction(key: string, fn: () => Promise<unknown>) {
    setPending(key)
    try {
      await fn()
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="border-b border-border px-5 py-3.5">
        <h2 className="text-[13px] font-semibold">My assets</h2>
      </div>

      {isLoading ? (
        <LoadingRows />
      ) : !hasAny ? (
        <EmptyState />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/20 text-left">
                <th className="px-5 py-3 font-medium text-muted-foreground">Asset</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Type</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">APY</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">Value</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {hasSO4 && (
                <tr className="border-b border-border/40 transition-colors hover:bg-muted/20">
                  <td className="px-5 py-3.5 font-medium">SO4</td>
                  <td className="px-5 py-3.5">
                    <TypeBadge kind="Staking" />
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-muted-foreground">—</td>
                  <td className="px-5 py-3.5 text-right font-mono">
                    {formatUsd(so4Stats?.stakedValueUsd ?? 0)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={pending === "so4"}
                      onClick={() =>
                        void runAction("so4", () =>
                          unstakeSO4("DUMMY_ACCOUNT", so4Stats?.stakedAmount ?? 0),
                        )
                      }
                    >
                      {pending === "so4" ? "…" : "Unstake"}
                    </Button>
                  </td>
                </tr>
              )}

              {gmPositions.map((pos) => (
                <tr
                  key={pos.poolId}
                  className="border-b border-border/40 transition-colors hover:bg-muted/20"
                >
                  <td className="px-5 py-3.5 font-medium">{pos.poolName}</td>
                  <td className="px-5 py-3.5">
                    <TypeBadge kind="GM" />
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-green-400">
                    {formatPct(pos.apy, { sign: false })}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono">{formatUsd(pos.balanceUsd)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={pending === pos.poolId}
                      onClick={() =>
                        void runAction(pos.poolId, () =>
                          withdrawGM("DUMMY_ACCOUNT", pos.poolName, pos.balanceTokens),
                        )
                      }
                    >
                      {pending === pos.poolId ? "…" : "Sell"}
                    </Button>
                  </td>
                </tr>
              ))}

              {glvPositions.map((pos) => (
                <tr
                  key={pos.vaultId}
                  className="border-b border-border/40 transition-colors hover:bg-muted/20 last:border-b-0"
                >
                  <td className="px-5 py-3.5 font-medium">
                    {pos.vaultName}{" "}
                    <span className="font-normal text-muted-foreground">[{pos.displayPair}]</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <TypeBadge kind="GLV" />
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-green-400">
                    {formatPct(pos.apy, { sign: false })}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono">{formatUsd(pos.balanceUsd)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={pending === pos.vaultId}
                      onClick={() =>
                        void runAction(pos.vaultId, () =>
                          withdrawGLV(
                            "DUMMY_ACCOUNT",
                            `${pos.vaultName} [${pos.displayPair}]`,
                            pos.balanceTokens,
                          ),
                        )
                      }
                    >
                      {pending === pos.vaultId ? "…" : "Sell"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
