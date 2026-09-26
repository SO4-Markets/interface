/**
 * apps/web/src/features/trade/components/positions/FundingActivityList.tsx
 *
 * OB-088: Show funding and fee activity with explicit units.
 *
 * Acceptance criteria:
 * - Sign, asset units, timestamps, and accrual/settlement status must match
 *   source fixtures and cannot be confused with trading PnL.
 * - A claim refreshes the relevant activity and balances through the shared flow;
 *   unsupported claims remain clearly unavailable.
 *
 * The data source is `useAccountFeeClaims` (paginated) for settled/claimed
 * records and `useAccountFundingHistory` for funding-specific rows (feeType=
 * "funding"). Both share the same `FeeClaim` shape from the indexer.
 */

import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { DataTable } from "@workspace/ui/components/data-table"
import { Numeric } from "@workspace/ui/components/numeric"
import { StatusBadge } from "@workspace/ui/components/status-badge"
import { useQueryClient } from "@tanstack/react-query"
import { useAccountFeeClaims } from "../../hooks/useAccountFeeClaims"
import { claimFundingFees } from "../../lib/stellar"
import { indexerQueryKeys } from "@/lib/graphql/query-keys"
import { activeQueryNetwork, queryKeys } from "../../lib/query-keys"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import type { FeeClaim } from "@/lib/graphql/types"
import type { Column } from "@workspace/ui/components/data-table"

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimestamp(ts: Date | string | number): string {
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  })
}

/**
 * Parse the raw `amount` string from the indexer into a JS number.
 * The amount is stored as an integer string in the token's native decimals.
 * We use the `token.decimals` field (defaults to 7 for Stellar assets) to
 * convert to a human-readable fractional value.
 */
function parseAmount(amount: string, decimals: number | null): number {
  const dec = decimals ?? 7
  return parseInt(amount, 10) / 10 ** dec
}

/**
 * OB-088: Map the indexer `status` field to a UI label that distinguishes
 * accrual (not yet settled) from settlement and claim stages.
 *
 * Known status values from the indexer schema:
 * - "accrued"   → fee has accrued but is not yet settled to the position
 * - "settled"   → fee has been settled; claimable if positive
 * - "claimed"   → user has already claimed this fee
 * - "cancelled" → fee was reversed / cancelled
 */
type FeeStatus = "accrued" | "settled" | "claimed" | "cancelled" | string

function feeStatusLabel(status: FeeStatus): string {
  switch (status) {
    case "accrued":   return "Accruing"
    case "settled":   return "Settled"
    case "claimed":   return "Claimed"
    case "cancelled": return "Cancelled"
    default:          return status
  }
}

function feeStatusVariant(status: FeeStatus): "success" | "warning" | "neutral" | "danger" {
  switch (status) {
    case "claimed":   return "success"
    case "settled":   return "warning"
    case "accrued":   return "neutral"
    case "cancelled": return "danger"
    default:          return "neutral"
  }
}

/**
 * OB-088: Whether a `feeType` value represents a funding-specific row.
 * Funding fees are the ones that can be claimed via claimFundingFees().
 */
function isFundingClaim(feeType: string): boolean {
  return feeType === "funding"
}

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  /** When provided, filter to a specific fee type (e.g. "funding"). */
  feeType?: string | null
}

export function FundingActivityList({ feeType = null }: Props) {
  const account = useWalletStore((state) => state.address)
  const queryClient = useQueryClient()
  const network = activeQueryNetwork()

  const feeHistory = useAccountFeeClaims(account, feeType)

  const [claiming, setClaiming] = useState<string | null>(null)
  const [claimError, setClaimError] = useState<string | null>(null)

  /** Claim a single settled funding-fee row. */
  async function handleClaim(row: FeeClaim) {
    if (!account || !row.market?.id) return
    const claimKey = row.id
    setClaiming(claimKey)
    setClaimError(null)
    try {
      await claimFundingFees(
        account,
        [row.market.id],
        row.token?.address ? [row.token.address] : [],
      )
      // Refresh fee history and balances after the claim transaction confirms.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: indexerQueryKeys.fees.pagesAll(account),
          refetchType: "active",
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.wallet.tokenBalances(account, network),
          refetchType: "active",
        }),
      ])
    } catch (e) {
      setClaimError(e instanceof Error ? e.message : "Claim failed")
    } finally {
      setClaiming(null)
    }
  }

  const columns: Array<Column<FeeClaim>> = [
    {
      id: "market",
      header: "Market",
      accessor: (row) => (
        <span className="font-medium">{row.market?.name ?? row.market?.key ?? "—"}</span>
      ),
    },
    {
      id: "type",
      header: "Type",
      accessor: (row) => (
        <span className="text-muted-foreground capitalize">{row.feeType.replace(/_/g, " ")}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessor: (row) => (
        <StatusBadge variant={feeStatusVariant(row.status)}>
          {/* OB-088: Accrual/settlement status must be unambiguous from trading PnL. */}
          {feeStatusLabel(row.status)}
        </StatusBadge>
      ),
    },
    {
      id: "amount",
      header: "Amount",
      accessor: (row) => {
        const symbol = row.token?.symbol ?? "?"
        const decimals = row.token?.decimals ?? null
        const amount = parseAmount(row.amount, decimals)
        // OB-088: Show the asset symbol explicitly — never omit units to avoid
        // confusion with a USD PnL figure.
        return (
          <span className="tabular-nums">
            <Numeric value={amount} format="token" decimals={decimals ?? 7} />
            {" "}
            <span className="text-muted-foreground">{symbol}</span>
          </span>
        )
      },
    },
    {
      id: "amountUsd",
      header: "Value",
      accessor: (row) =>
        row.amountUsd ? (
          <Numeric value={parseFloat(row.amountUsd)} format="usd" />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "timestamp",
      header: "Time",
      accessor: (row) => (
        <span className="text-muted-foreground">{formatTimestamp(row.timestamp)}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      accessor: (row) => {
        // OB-088: Only settled funding-type rows support a claim action. All
        // other types (position fees, UI fees) are settled automatically and
        // have no claim path — they must remain clearly unavailable.
        const canClaim =
          isFundingClaim(row.feeType) &&
          row.status === "settled" &&
          !!row.market?.id

        if (!canClaim) {
          // Explicitly show that claim is not applicable rather than hiding it,
          // so the user can tell this is intentional and not a bug.
          if (row.status === "accrued" || row.status === "settled") {
            return (
              <span
                className="text-xs text-muted-foreground"
                title={
                  row.status === "accrued"
                    ? "Accruing — will become claimable after settlement"
                    : "Claim not available for this fee type"
                }
              >
                Unavailable
              </span>
            )
          }
          return null
        }

        return (
          <Button
            size="xs"
            variant="outline"
            pending={claiming === row.id}
            disabled={claiming !== null}
            onClick={() => void handleClaim(row)}
          >
            Claim
          </Button>
        )
      },
    },
  ]

  if (feeHistory.isDisabled) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        Fee activity is unavailable while the indexer is disabled.
      </div>
    )
  }

  return (
    <div>
      {claimError && (
        <p
          role="alert"
          className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive"
        >
          {claimError}
        </p>
      )}

      <DataTable
        columns={columns}
        data={feeHistory.data}
        isLoading={feeHistory.isLoading}
        emptyMessage={
          feeHistory.error
            ? "Unable to load fee activity. Try again shortly."
            : feeType === "funding"
              ? "No funding activity"
              : "No fee activity"
        }
        keyExtractor={(row) => row.id}
      />

      {feeHistory.hasNextPage && (
        <div className="flex justify-center border-t border-border p-3">
          <Button
            size="sm"
            variant="outline"
            pending={feeHistory.isFetchingNextPage}
            onClick={feeHistory.fetchNextPage}
          >
            Load older activity
          </Button>
        </div>
      )}
    </div>
  )
}
