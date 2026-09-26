import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Button } from "@workspace/ui/components/button"
import { DataTable } from "@workspace/ui/components/data-table"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { Numeric } from "@workspace/ui/components/numeric"
import { usePositions } from "../../hooks/usePositions"
import { hasFrozenOrders, useOrders } from "../../hooks/useOrders"
import { claimFundingFees } from "../../lib/stellar"
import { OrderExecutionFrozenBanner } from "./OrderExecutionFrozenBanner"
import { PositionsList } from "./PositionsList"
import { OrdersList } from "./OrdersList"
import { OrderHistoryList } from "./OrderHistoryList"
import { TradeHistoryList } from "./TradeHistoryList"
import type { Position } from "../../hooks/usePositions"
import { useWalletStore } from "@/features/wallet/store/wallet-store"

type Props = {
  onSelectPosition?: (position: Position) => void
  value?: "positions" | "orders" | "history" | "trades" | "claims"
  onValueChange?: (value: "positions" | "orders" | "history" | "trades" | "claims") => void
}

export function BottomTabs({ onSelectPosition, value, onValueChange }: Props) {
  const { data: positions = [] } = usePositions()
  const { data: orders = [] } = useOrders()
  const account = useWalletStore((state) => state.address)
  const [claimingAll, setClaimingAll] = useState(false)

  const claimablePositions = positions.filter((p) => p.fundingFeeUsd > 0)
  const totalClaimable = claimablePositions.reduce((sum, p) => sum + p.fundingFeeUsd, 0)

  async function handleClaimAll() {
    if (!account || claimablePositions.length === 0) return
    setClaimingAll(true)
    try {
      const marketAddresses = claimablePositions.map((p) => p.marketAddress)
      const tokens = claimablePositions.map((p) => p.collateralToken)
      await claimFundingFees(account, marketAddresses, tokens)
    } finally {
      setClaimingAll(false)
    }
  }

  return (
    <Tabs value={value} defaultValue="positions" onValueChange={(next) => onValueChange?.(next as NonNullable<Props["value"]>)}>
      <OrderExecutionFrozenBanner visible={hasFrozenOrders(orders)} />
      <TabsList className="border-b border-border bg-transparent px-4">
        <TabsTrigger value="positions">
          Positions {positions.length > 0 && `(${positions.length})`}
        </TabsTrigger>
        <TabsTrigger value="orders">
          Orders {orders.length > 0 && `(${orders.length})`}
        </TabsTrigger>
        <TabsTrigger value="history">Order history</TabsTrigger>
        <TabsTrigger value="trades">
          Trades
        </TabsTrigger>
        <TabsTrigger value="claims">
          Claims
          {/* TODO: Show badge when claimable funding fees > 0 */}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="positions">
        <PositionsList onSelectPosition={onSelectPosition} />
      </TabsContent>

      <TabsContent value="orders">
        <OrdersList />
      </TabsContent>

      <TabsContent value="history">
        <OrderHistoryList />
      </TabsContent>

      <TabsContent value="trades">
        <TradeHistoryList />
      </TabsContent>

      <TabsContent value="claims">
        {claimablePositions.length > 0 ? (
          <div className="space-y-2 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Total claimable: <Numeric value={totalClaimable} format="usd" role="positive" />
              </span>
              <Button
                size="xs"
                variant="outline"
                disabled={claimingAll}
                onClick={() => void handleClaimAll()}
              >
                {claimingAll ? "Claiming..." : "Claim All"}
              </Button>
            </div>
            <DataTable
              columns={[
                {
                  id: "market",
                  header: "Market",
                  accessor: (p) => <span className="font-medium">{p.marketName}</span>,
                },
                {
                  id: "fee",
                  header: "Fee",
                  accessor: (p) => <Numeric value={p.fundingFeeUsd} format="usd" role="positive" />,
                },
              ]}
              data={claimablePositions}
              keyExtractor={(p) => p.key}
            />
          </div>
        ) : (
          <EmptyState
            title="No claimable funding fees"
            description="Funding fees from your positions will appear here."
          />
        )}
      </TabsContent>
    </Tabs>
  )
}
