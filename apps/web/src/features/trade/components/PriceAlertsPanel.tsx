"use client"

import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Switch } from "@workspace/ui/components/switch"
import { EmptyState } from "@workspace/ui/components/states"
import { usePriceAlertsStore } from "../store/price-alerts-store"
import { PriceAlertDialog } from "./PriceAlertDialog"
import type { MarketOption } from "./PriceAlertDialog"

type Props = {
  markets: Array<MarketOption>
  defaultMarketAddress?: string
}

/**
 * Panel that lists the user's price alerts and lets them add new ones.
 * Rendered inside the trade workspace bottom-tabs area or a settings sheet.
 *
 * Layout:
 *   [+ Add alert]  ← top-right action
 *   List of alert rows:
 *     Market · direction · threshold  [enabled switch]  [×]
 *   Empty state when no alerts exist.
 */
export function PriceAlertsPanel({ markets, defaultMarketAddress }: Props) {
  const { alerts, removeAlert, setAlertEnabled, clearFiredAlerts } =
    usePriceAlertsStore()
  const [dialogOpen, setDialogOpen] = useState(false)

  const activeAlerts = alerts.filter((a) => a.firedAt === null)
  const firedAlerts = alerts.filter((a) => a.firedAt !== null)

  return (
    <section aria-label="Price alerts" className="flex flex-col gap-3 p-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Price alerts</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDialogOpen(true)}
          aria-label="Add price alert"
        >
          + Add alert
        </Button>
      </div>

      {/* Active alerts */}
      {activeAlerts.length === 0 && firedAlerts.length === 0 ? (
        <EmptyState
          title="No price alerts"
          description="Set a price threshold to receive a notification when a market reaches it."
          actions={[
            {
              label: "Add alert",
              onClick: () => setDialogOpen(true),
            },
          ]}
        />
      ) : (
        <>
          {activeAlerts.length > 0 && (
            <ul
              role="list"
              aria-label="Active alerts"
              className="flex flex-col gap-1"
            >
              {activeAlerts.map((alert) => (
                <li
                  key={alert.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                >
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="font-medium">{alert.marketName}</span>
                    {" "}
                    <span className="text-muted-foreground">
                      {alert.direction}{" "}
                      {alert.threshold.toLocaleString(undefined, {
                        maximumFractionDigits: 6,
                      })}
                    </span>
                  </span>

                  <Switch
                    checked={alert.enabled}
                    onCheckedChange={(value: boolean) =>
                      setAlertEnabled(alert.id, value)
                    }
                    aria-label={`${alert.enabled ? "Disable" : "Enable"} alert for ${alert.marketName}`}
                  />

                  <button
                    type="button"
                    onClick={() => removeAlert(alert.id)}
                    aria-label={`Delete alert for ${alert.marketName}`}
                    className="rounded-sm p-1 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Fired alerts */}
          {firedAlerts.length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Triggered
                </span>
                <button
                  type="button"
                  onClick={clearFiredAlerts}
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  Clear all
                </button>
              </div>
              <ul role="list" aria-label="Triggered alerts" className="flex flex-col gap-1">
                {firedAlerts.map((alert) => (
                  <li
                    key={alert.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border/50 px-3 py-2 opacity-60"
                  >
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-medium">{alert.marketName}</span>
                      {" "}
                      <span className="text-muted-foreground">
                        {alert.direction}{" "}
                        {alert.threshold.toLocaleString(undefined, {
                          maximumFractionDigits: 6,
                        })}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        (triggered)
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAlert(alert.id)}
                      aria-label={`Delete triggered alert for ${alert.marketName}`}
                      className="rounded-sm p-1 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <PriceAlertDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        markets={markets}
        defaultMarketAddress={defaultMarketAddress}
      />
    </section>
  )
}
