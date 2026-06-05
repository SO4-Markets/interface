import { CONTRACTS } from "@/app/config/contracts"
import { NETWORK } from "@/app/config/network"
import {
  Client,
  type MarketProps,
  type PoolValueInfo,
  type FundingInfo,
  type PositionInfo,
  type OrderProps,
} from "./generated/synthetics-reader/src"

export type { MarketProps, PoolValueInfo, FundingInfo, PositionInfo, OrderProps }

/**
 * Thin wrapper around the generated SyntheticsReader Soroban client.
 *
 * The Reader contract requires three infra addresses as explicit arguments:
 *   data_store    — key-value config + position/order storage
 *   oracle        — on-chain price feed
 *   order_handler — owns position/order account sets
 *
 * This wrapper resolves them from CONTRACTS so callers never touch addresses.
 */
export class SyntheticsReaderClient {
  private client: Client

  constructor() {
    this.client = new Client({
      contractId: CONTRACTS.syntheticsReader,
      networkPassphrase: NETWORK.networkPassphrase,
      rpcUrl: NETWORK.rpcUrl,
    })
  }

  // ── Market ────────────────────────────────────────────────────────────────

  getMarket(marketToken: string): Promise<MarketProps> {
    return this.client.getMarket(CONTRACTS.dataStore, marketToken)
  }

  getMarketPoolValueInfo(marketToken: string, maximize = false): Promise<PoolValueInfo> {
    return this.client.getMarketPoolValueInfo(
      CONTRACTS.dataStore,
      CONTRACTS.oracle,
      marketToken,
      maximize,
    )
  }

  getOpenInterest(marketToken: string): Promise<{ long: bigint; short: bigint }> {
    return this.client.getOpenInterest(CONTRACTS.dataStore, marketToken)
  }

  getFundingInfo(marketToken: string): Promise<FundingInfo> {
    return this.client.getFundingInfo(CONTRACTS.dataStore, marketToken)
  }

  // ── Positions ─────────────────────────────────────────────────────────────

  getAccountPositions(account: string, page = 1, pageSize = 20): Promise<Array<PositionInfo>> {
    return this.client.getAccountPositions(
      CONTRACTS.dataStore,
      CONTRACTS.oracle,
      CONTRACTS.orderHandler,
      account,
      page,
      pageSize,
    )
  }

  // ── Orders ────────────────────────────────────────────────────────────────

  getAccountOrders(account: string, page = 1, pageSize = 50): Promise<Array<OrderProps>> {
    return this.client.getAccountOrders(
      CONTRACTS.dataStore,
      CONTRACTS.orderHandler,
      account,
      page,
      pageSize,
    )
  }
}
