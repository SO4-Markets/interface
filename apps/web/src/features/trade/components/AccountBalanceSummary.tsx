import { Numeric } from "@workspace/ui/components/numeric"
import { useAccountBalanceSummary } from "../hooks/useAccountBalanceSummary"

export function AccountBalanceSummary() {
  const summary = useAccountBalanceSummary()

  if (!summary) {
    return (
      <div className="rounded-lg border border-border bg-surface-secondary p-4">
        <div className="text-sm text-muted-foreground">Not connected</div>
      </div>
    )
  }

  const rows = [
    {
      label: "Wallet Balance",
      value: summary.walletBalance,
      description: "Available in connected wallet",
    },
    {
      label: "Deposited Collateral",
      value: summary.depositedCollateral,
      description: "Funds locked in active positions",
    },
    {
      label: "Reserved for Orders",
      value: summary.reservedFunds - summary.depositedCollateral,
      description: "Pending and accepted orders",
    },
  ]

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-secondary p-4">
      {/* Summary rows */}
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{row.label}</span>
              <span className="text-xs text-muted-foreground">{row.description}</span>
            </div>
            <Numeric value={row.value} format="usd" decimals={2} className="font-mono" />
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Available to trade (highlighted) */}
      <div className="flex items-center justify-between rounded-md bg-background p-2">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">Available to Trade</span>
          <span className="text-xs text-muted-foreground">Can place orders with this amount</span>
        </div>
        <Numeric
          value={summary.availableToTrade}
          format="usd"
          decimals={2}
          className="font-mono text-lg font-semibold text-success"
        />
      </div>

      {/* Total account value */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Total Account Value</span>
        <Numeric value={summary.totalAccountValue} format="usd" decimals={2} className="font-mono" />
      </div>
    </div>
  )
}
