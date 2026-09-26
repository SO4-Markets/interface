import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { DataTable } from "@workspace/ui/components/data-table"
import { StatusBadge } from "@workspace/ui/components/status-badge"
import { Numeric } from "@workspace/ui/components/numeric"
import { useOrdersWithIndexer } from "../../hooks/useOrdersWithIndexer"
import { amendOrderViaReplace, cancelOrder } from "../../lib/stellar"
import { getOrderAmendCapability, type AmendPayload, type AmendReplaceOutcome } from "../../lib/order-amendment"
import type { OrderLifecycleStage } from "../../lib/order-lifecycle"
import { AmendOrderDialog, type AmendTarget } from "./AmendOrderDialog"
import { AccountOrderCard } from "./AccountRowDetails"
import type { Column } from "@workspace/ui/components/data-table"
import type { OrderWithIndexer } from "../../hooks/useOrdersWithIndexer"
import type { OrderKey } from "@/lib/contracts"

function toOrderKey(order: OrderWithIndexer): OrderKey {
  return order.key
}

function toLifecycleStage(order: OrderWithIndexer): OrderLifecycleStage {
  if (order.awaitingIndex) return "pending"
  if (order.status === "frozen") return "frozen"
  return "accepted"
}

function toAmendTarget(order: OrderWithIndexer): AmendTarget {
  return {
    orderKey: order.key,
    marketName: order.marketName,
    orderType: order.orderType,
    isLong: order.isLong,
    triggerPrice: order.triggerPrice,
    remainingSizeUsd: order.sizeUsd,
    filledSizeUsd: 0,
    stage: toLifecycleStage(order),
    awaitingIndex: order.awaitingIndex,
  }
}

export function OrdersList() {
  const { data: orders = [], isLoading, isDisabled } = useOrdersWithIndexer()
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [amending, setAmending] = useState<OrderWithIndexer | null>(null)
  const [amendError, setAmendError] = useState<string | null>(null)

  async function handleCancel(order: OrderWithIndexer) {
    setCancelling(order.key)
    try {
      await cancelOrder(order.account, toOrderKey(order))
    } finally {
      setCancelling(null)
    }
  }

  async function handleAmend(payload: AmendPayload): Promise<AmendReplaceOutcome> {
    if (!amending) throw new Error("No order selected for amendment.")
    const target = amending
    setAmendError(null)
    const outcome = await amendOrderViaReplace(
      target.account,
      {
        orderKey: target.key,
        marketAddress: target.marketAddress,
        collateralToken: target.collateralToken,
        orderType: target.orderType,
        isLong: target.isLong,
        acceptablePrice: target.acceptablePrice,
        triggerPrice: target.triggerPrice,
        positionKey: target.positionKey,
        remainingSizeUsd: target.sizeUsd,
        filledSizeUsd: 0,
        stage: toLifecycleStage(target),
        awaitingIndex: target.awaitingIndex,
      },
      payload,
    )
    if (outcome.status === "replace-failed") {
      // Original is gone: close the dialog and surface the terminal state in
      // the table banner — never render the cancelled row as live.
      setAmending(null)
      setAmendError(
        `Order cancelled, but the replacement failed: ${outcome.error}. Place a new order manually.`,
      )
    }
    return outcome
  }

  const columns: Array<Column<OrderWithIndexer>> = [
    {
      id: "market",
      header: "Market",
      accessor: (o) => (
        <div className="flex items-center gap-1.5">
          <span className="font-medium">{o.marketName}</span>
          <StatusBadge variant={o.isLong ? "success" : "danger"}>
            {o.isLong ? "Long" : "Short"}
          </StatusBadge>
          <StatusBadge variant={o.status === "frozen" ? "warning" : "neutral"}>
            {cancelling === o.key ? "Cancelling" : o.awaitingIndex ? "Pending index" : o.status === "frozen" ? "Frozen" : "Open"}
          </StatusBadge>
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      accessor: (o) => <span className="text-muted-foreground">{o.orderType}</span>,
    },
    {
      id: "size",
      header: "Original / remaining",
      accessor: (o) => (
        <div className="tabular-nums">
          <Numeric value={o.sizeUsd} format="usd" />
          <span className="text-muted-foreground"> / </span>
          <Numeric value={o.sizeUsd} format="usd" />
        </div>
      ),
    },
    {
      id: "trigger",
      header: "Trigger",
      accessor: (o) => o.limitOrTrigger === "market" ? (
        <span className="text-muted-foreground">Market</span>
      ) : (
        <div>
          <span className="text-muted-foreground">{o.limitOrTrigger === "limit" ? "Limit" : "Trigger"}: </span>
          <Numeric value={o.triggerPrice} format="usd" />
        </div>
      ),
    },
    {
      id: "created",
      header: "Created",
      accessor: (o) => (
        <span className="text-muted-foreground">
          {new Date(o.updatedAt).toLocaleTimeString()}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      accessor: (o) => {
        const capability = getOrderAmendCapability({
          orderType: o.orderType,
          stage: toLifecycleStage(o),
          awaitingIndex: o.awaitingIndex,
        })
        return (
          <div className="flex items-center gap-1.5">
            <Button
              size="xs"
              variant="outline"
              disabled={!capability.canAmend || o.awaitingIndex}
              title={capability.canAmend ? "Amend via cancel-and-replace (loses queue priority)" : (capability.reason ?? "Cannot amend")}
              aria-label={capability.canAmend ? `Amend ${o.marketName} order` : `Amend unavailable: ${capability.reason ?? "unsupported"}`}
              onClick={() => {
                setAmendError(null)
                setAmending(o)
              }}
            >
              Edit
            </Button>
            <Button
              size="xs"
              variant="outline"
              disabled={o.awaitingIndex || cancelling === o.key}
              onClick={() => void handleCancel(o)}
            >
              {cancelling === o.key ? "…" : "Cancel"}
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <>
      {isDisabled && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-500">
          ⚠️ Indexer disabled - Order history unavailable. Showing live contract data only.
        </div>
      )}
      {amendError && (
        <p role="alert" className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {amendError}
        </p>
      )}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={orders}
          isLoading={isLoading}
          emptyMessage={isDisabled ? "Indexer disabled - showing contract-only data" : "No open orders"}
          keyExtractor={(o) => o.clientOrderId}
        />
      </div>
      {/* Narrow-screen cards mirror the table with identical labels and actions (OB-090). */}
      <div className="space-y-2 p-3 md:hidden" role="list" aria-label="Open orders">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading orders…</p>
        ) : orders.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {isDisabled ? "Indexer disabled - showing contract-only data" : "No open orders"}
          </p>
        ) : (
          orders.map((o) => {
            const capability = getOrderAmendCapability({
              orderType: o.orderType,
              stage: toLifecycleStage(o),
              awaitingIndex: o.awaitingIndex,
            })
            const statusLabel =
              cancelling === o.key ? "Cancelling" : o.awaitingIndex ? "Pending index" : o.status === "frozen" ? "Frozen" : "Open"
            return (
              <div key={o.clientOrderId} role="listitem">
                <AccountOrderCard
                  rowKey={o.clientOrderId}
                  marketName={o.marketName}
                  sideBadge={{ label: o.isLong ? "Long" : "Short", variant: o.isLong ? "success" : "danger" }}
                  statusBadge={{ label: statusLabel, variant: o.status === "frozen" ? "warning" : "neutral" }}
                  summarySizeUsd={o.sizeUsd}
                  fields={[
                    { label: "Type", value: <span className="text-muted-foreground">{o.orderType}</span> },
                    {
                      label: "Original / remaining",
                      value: (
                        <span className="tabular-nums">
                          <Numeric value={o.sizeUsd} format="usd" />
                          <span className="text-muted-foreground"> / </span>
                          <Numeric value={o.sizeUsd} format="usd" />
                        </span>
                      ),
                    },
                    {
                      label: "Trigger",
                      value:
                        o.limitOrTrigger === "market" ? (
                          <span className="text-muted-foreground">Market</span>
                        ) : (
                          <span>
                            <span className="text-muted-foreground">
                              {o.limitOrTrigger === "limit" ? "Limit" : "Trigger"}:{" "}
                            </span>
                            <Numeric value={o.triggerPrice} format="usd" />
                          </span>
                        ),
                    },
                    {
                      label: "Created",
                      value: <span className="text-muted-foreground">{new Date(o.updatedAt).toLocaleTimeString()}</span>,
                    },
                  ]}
                  actions={[
                    {
                      label: "Edit",
                      disabled: !capability.canAmend || o.awaitingIndex,
                      disabledReason: capability.canAmend ? "Unavailable while pending" : (capability.reason ?? "Unsupported"),
                      onClick: () => {
                        setAmendError(null)
                        setAmending(o)
                      },
                    },
                    {
                      label: "Cancel",
                      disabled: o.awaitingIndex,
                      pending: cancelling === o.key,
                      onClick: () => void handleCancel(o),
                    },
                  ]}
                />
              </div>
            )
          })
        )}
      </div>
      <AmendOrderDialog
        order={amending ? toAmendTarget(amending) : null}
        open={amending !== null}
        onClose={() => setAmending(null)}
        onSubmit={handleAmend}
      />
    </>
  )
}
