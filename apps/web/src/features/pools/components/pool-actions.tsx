import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { PoolTransactionDialog } from "./pool-transaction-dialog"
import type { PoolMarketConfig } from "../data/markets"
import { formatSorobanAmount } from "@/shared/lib/bignum"
import { formatTxHash } from "@/shared/lib/format"

type PoolActionsProps = {
  hasWallet: boolean
  hasUserGm: boolean
  account: string | null
  market: PoolMarketConfig
  userGmBalance: bigint
}

type PendingPoolTx = {
  mode: "deposit" | "withdraw"
  hash: string
  expectedAmount: bigint | null
}

export function PoolActions({
  hasWallet,
  hasUserGm,
  account,
  market,
  userGmBalance,
}: PoolActionsProps) {
  const [dialogMode, setDialogMode] = useState<"deposit" | "withdraw" | null>(null)
  const [pendingTx, setPendingTx] = useState<PendingPoolTx | null>(null)

  if (!hasWallet) {
    return (
      <Button variant="outline" size="sm" className="h-8" disabled>
        Connect
      </Button>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => setDialogMode("deposit")}
        >
          Deposit
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          disabled={!hasUserGm}
          onClick={() => setDialogMode("withdraw")}
        >
          Withdraw
        </Button>
        <Link
          to="/faucet"
          className="inline-flex h-8 shrink-0 items-center justify-center rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Faucet
        </Link>
      </div>

      {pendingTx ? (
        <div className="ml-auto max-w-56 rounded-md border border-primary/20 bg-primary/5 p-2 text-left text-[11px] leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">
            {pendingTx.mode === "deposit" ? "Deposit pending" : "Withdrawal pending"}
          </p>
          <p>Keeper execution usually completes within ~60s.</p>
          <p className="font-mono">{formatTxHash(pendingTx.hash)}</p>
          {pendingTx.expectedAmount != null ? (
            <p>
              Est. {pendingTx.mode === "deposit" ? "GM" : "tokens"}:{" "}
              {formatSorobanAmount(pendingTx.expectedAmount, market.decimals, 4)}
            </p>
          ) : null}
        </div>
      ) : null}

      {account && dialogMode ? (
        <PoolTransactionDialog
          open
          mode={dialogMode}
          market={market}
          account={account}
          userGmBalance={userGmBalance}
          onClose={() => setDialogMode(null)}
          onQueued={(tx) => setPendingTx(tx)}
        />
      ) : null}
    </div>
  )
}
