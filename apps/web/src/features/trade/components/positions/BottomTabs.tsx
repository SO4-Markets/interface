import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { usePositions } from "../../hooks/usePositions"
import { useOrders } from "../../hooks/useOrders"
import { PositionsList } from "./PositionsList"
import { OrdersList } from "./OrdersList"
import type { Position } from "../../hooks/usePositions"

// TODO: Add Trades and Claims tabs once tradeHistory + claimFundingFees are wired up

type Props = {
  onSelectPosition?: (position: Position) => void
}

export function BottomTabs({ onSelectPosition }: Props) {
  const { data: positions = [] } = usePositions()
  const { data: orders = [] } = useOrders()

  return (
    <Tabs defaultValue="positions">
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
        <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
          {/* TODO: Implement Claims using claimFundingFees from stellar.ts */}
          Claims coming soon
        </div>
      </TabsContent>
    </Tabs>
  )
}
