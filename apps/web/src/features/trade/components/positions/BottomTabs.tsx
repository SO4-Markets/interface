import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { usePositions } from "../../hooks/usePositions"
import { hasFrozenOrders, useOrders } from "../../hooks/useOrders"
import { OrderExecutionFrozenBanner } from "./OrderExecutionFrozenBanner"
import { PositionsList } from "./PositionsList"
import { OrdersList } from "./OrdersList"
import { OrderHistoryList } from "./OrderHistoryList"
import { TradeHistoryList } from "./TradeHistoryList"
import { FundingActivityList } from "./FundingActivityList"
import type { Position } from "../../hooks/usePositions"

type Props = {
  onSelectPosition?: (position: Position) => void
  value?: "positions" | "orders" | "history" | "trades" | "claims"
  onValueChange?: (value: "positions" | "orders" | "history" | "trades" | "claims") => void
}

export function BottomTabs({ onSelectPosition, value, onValueChange }: Props) {
  const { data: positions = [] } = usePositions()
  const { data: orders = [] } = useOrders()

  // OB-088: The claimable funding fee summary that was in this component has
  // moved into FundingActivityList, which shows all fee/funding activity with
  // explicit units, accrual/settlement status, and per-row claim actions.
  // This keeps BottomTabs lean and delegates fee display to the specialised list.

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
          {/* OB-088: Label updated to "Funding & Fees" to reflect that this tab
              now shows the full activity history (accrued, settled, claimed) —
              not just a snapshot of claimable amounts. */}
          Funding &amp; Fees
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

      {/* OB-088: Replaced the ad-hoc claimable-positions table with FundingActivityList,
          which shows all fee/funding activity from the indexer with explicit token units,
          accrual/settlement status (so it cannot be confused with trading PnL), and
          per-row claim actions only for settled funding-type rows. */}
      <TabsContent value="claims">
        <FundingActivityList feeType="funding" />
      </TabsContent>
    </Tabs>
  )
}
