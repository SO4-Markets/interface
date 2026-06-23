import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Button } from "@workspace/ui/components/button"
import { usePositions } from "../../hooks/usePositions"
import { hasFrozenOrders, useOrders } from "../../hooks/useOrders"
import { claimFundingFees } from "../../lib/stellar"
import { OrderExecutionFrozenBanner } from "./OrderExecutionFrozenBanner"
import { PositionsList } from "./PositionsList"
import { OrdersList } from "./OrdersList"
import type { Position } from "../../hooks/usePositions"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import { formatUsd } from "@/shared/lib/format"

// TODO: Add Trades and Claims tabs once tradeHistory + claimFundingFees are wired up

type Props = {
  onSelectPosition?: (position: Position) => void
}

export function BottomTabs({ onSelectPosition }: Props) {
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
    <Tabs defaultValue="positions">
      <OrderExecutionFrozenBanner visible={hasFrozenOrders(orders)} />
      <TabsList className="border-b border-border bg-transparent px-4">
        <TabsTrigger value="positions">
          Positions {positions.length > 0 && `(${positions.length})`}
        </TabsTrigger>
        <TabsTrigger value="orders">
          Orders {orders.length > 0 && `(${orders.length})`}
        </TabsTrigger>
        <TabsTrigger value="trades">
          Trades
          {/* TODO: Show count from useTradeHistory once implemented */}
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

      <TabsContent value="trades">
        <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
          {/* TODO: Implement TradeHistoryList using useTradeHistory (TanStack Query + Soroban events) */}
          Trade history coming soon
        </div>
      </TabsContent>

      <TabsContent value="claims">
        {claimablePositions.length > 0 ? (
          <div className="space-y-2 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Total claimable: {formatUsd(totalClaimable)}</span>
              <Button
                size="xs"
                variant="outline"
                disabled={claimingAll}
                onClick={() => void handleClaimAll()}
              >
                {claimingAll ? "Claiming..." : "Claim All"}
              </Button>
            </div>
            <div className="space-y-1">
              {claimablePositions.map((p) => (
                <div key={p.key} className="flex items-center justify-between rounded border border-border/50 px-3 py-2 text-xs">
                  <span className="font-medium">{p.marketName}</span>
                  <span className="text-green-500">{formatUsd(p.fundingFeeUsd)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
            No claimable funding fees
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}
