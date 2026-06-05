import { Buffer } from "buffer"
import { Address, Contract, rpc, xdr } from "@stellar/stellar-sdk"

if (typeof window !== "undefined") {
  window.Buffer = window.Buffer || Buffer
}

// ── Return types ─────────────────────────────────────────────────────────────
// These mirror the Rust #[contracttype] structs returned by the Reader contract.

/** Mirrors gmx_types::MarketProps */
export interface MarketProps {
  marketToken: string
  indexToken: string
  longToken: string
  shortToken: string
}

/** Mirrors gmx_types::PoolValueInfo */
export interface PoolValueInfo {
  poolValue: bigint
  longTokenAmount: bigint
  shortTokenAmount: bigint
  longTokenUsd: bigint
  shortTokenUsd: bigint
  longPnl: bigint
  shortPnl: bigint
  netPnl: bigint
  totalBorrowingFees: bigint
  impactPoolAmount: bigint
}

/** Mirrors gmx_types::FundingInfo */
export interface FundingInfo {
  fundingFactorPerSecond: bigint
  longFundingAmountPerSize: bigint
  shortFundingAmountPerSize: bigint
}

/** Mirrors gmx_types::PositionProps (inner struct inside PositionInfo) */
export interface PositionProps {
  account: string
  market: string
  collateralToken: string
  sizeInUsd: bigint
  sizeInTokens: bigint
  collateralAmount: bigint
  isLong: boolean
}

/** Mirrors gmx_types::PositionInfo (enriched view returned by Reader) */
export interface PositionInfo {
  position: PositionProps
  pnlUsd: bigint
  uncappedPnlUsd: bigint
  borrowingFeeUsd: bigint
  fundingFeeUsd: bigint
  positionFeeUsd: bigint
  liquidationPrice: bigint
}

/** Mirrors gmx_types::OrderProps */
export interface OrderProps {
  account: string
  receiver: string
  market: string
  initialCollateralToken: string
  sizeDeltaUsd: bigint
  collateralDeltaAmount: bigint
  triggerPrice: bigint
  acceptablePrice: bigint
  executionFee: bigint
  orderType: string
  isLong: boolean
  updatedAtTime: bigint
}

// ── ScVal decode helpers ─────────────────────────────────────────────────────

function decodeAddress(v: xdr.ScVal | undefined): string {
  if (!v) return ""
  try {
    return Address.fromScVal(v).toString()
  } catch {
    // fall back for scvString-encoded addresses
    return v.str?.toString() ?? ""
  }
}

function decodeI128(v: xdr.ScVal | undefined): bigint {
  if (!v) return 0n
  try {
    const p = v.i128()
    if (!p) return 0n
    const lo = BigInt(p.lo().toString())
    const hi = BigInt(p.hi().toString())
    return (hi << 64n) | lo
  } catch {
    return 0n
  }
}

function fieldVal(m: xdr.ScMapEntry[], name: string): xdr.ScVal | undefined {
  return m.find((e) => {
    try { return e.key().sym() === name } catch { return false }
  })?.val()
}

function decodeMap(v: xdr.ScVal | undefined): xdr.ScMapEntry[] {
  if (!v) return []
  return v.map() ?? []
}

function decodeVec(v: xdr.ScVal | undefined): xdr.ScVal[] {
  if (!v) return []
  return v.vec() ?? []
}

function decodeBool(v: xdr.ScVal | undefined): boolean {
  if (!v) return false
  try { return v.b() } catch { return false }
}

function decodeSymbol(v: xdr.ScVal | undefined): string {
  if (!v) return ""
  try { return v.sym() } catch { return "" }
}

function decodeEnumVariant(v: xdr.ScVal | undefined): string {
  // Soroban #[contracttype] unit-enum → single-entry Map {Symbol(name): Void}
  const m = decodeMap(v)
  if (m.length === 0) return ""
  try { return m[0].key().sym() } catch { return "" }
}

function decodePositionProps(v: xdr.ScVal): PositionProps {
  const m = decodeMap(v)
  return {
    account:         decodeAddress(fieldVal(m, "account")),
    market:          decodeAddress(fieldVal(m, "market")),
    collateralToken: decodeAddress(fieldVal(m, "collateral_token")),
    sizeInUsd:       decodeI128(fieldVal(m, "size_in_usd")),
    sizeInTokens:    decodeI128(fieldVal(m, "size_in_tokens")),
    collateralAmount:decodeI128(fieldVal(m, "collateral_amount")),
    isLong:          decodeBool(fieldVal(m, "is_long")),
  }
}

function decodePositionInfo(v: xdr.ScVal): PositionInfo {
  const m = decodeMap(v)
  return {
    position:        decodePositionProps(fieldVal(m, "position") ?? xdr.ScVal.scvVoid()),
    pnlUsd:          decodeI128(fieldVal(m, "pnl_usd")),
    uncappedPnlUsd:  decodeI128(fieldVal(m, "uncapped_pnl_usd")),
    borrowingFeeUsd: decodeI128(fieldVal(m, "borrowing_fee_usd")),
    fundingFeeUsd:   decodeI128(fieldVal(m, "funding_fee_usd")),
    positionFeeUsd:  decodeI128(fieldVal(m, "position_fee_usd")),
    liquidationPrice:decodeI128(fieldVal(m, "liquidation_price")),
  }
}

function decodeOrderProps(v: xdr.ScVal): OrderProps {
  const m = decodeMap(v)
  return {
    account:               decodeAddress(fieldVal(m, "account")),
    receiver:              decodeAddress(fieldVal(m, "receiver")),
    market:                decodeAddress(fieldVal(m, "market")),
    initialCollateralToken:decodeAddress(fieldVal(m, "initial_collateral_token")),
    sizeDeltaUsd:          decodeI128(fieldVal(m, "size_delta_usd")),
    collateralDeltaAmount: decodeI128(fieldVal(m, "collateral_delta_amount")),
    triggerPrice:          decodeI128(fieldVal(m, "trigger_price")),
    acceptablePrice:       decodeI128(fieldVal(m, "acceptable_price")),
    executionFee:          decodeI128(fieldVal(m, "execution_fee")),
    orderType:             decodeEnumVariant(fieldVal(m, "order_type")),
    isLong:                decodeBool(fieldVal(m, "is_long")),
    updatedAtTime:         BigInt(fieldVal(m, "updated_at_time")?.u64()?.toString() ?? "0"),
  }
}

// ── Client options ────────────────────────────────────────────────────────────

export interface ClientOptions {
  contractId: string
  networkPassphrase: string
  rpcUrl: string
}

// ── Client ───────────────────────────────────────────────────────────────────
//
// All methods are read-only — they use simulateTransaction to call the Reader
// contract and decode the returned ScVal.
//
// The Reader contract requires several infrastructure addresses as explicit
// arguments (data_store, oracle, order_handler) because it reads from them
// cross-contract at query time.

export class Client {
  private contract: Contract
  private rpcUrl: string
  private networkPassphrase: string

  constructor(opts: ClientOptions) {
    this.contract = new Contract(opts.contractId)
    this.rpcUrl = opts.rpcUrl
    this.networkPassphrase = opts.networkPassphrase
  }

  private async sim(method: string, ...args: xdr.ScVal[]): Promise<xdr.ScVal> {
    const server = new rpc.Server(this.rpcUrl)
    const call = this.contract.call(method, ...args)
    const result = await server.simulateTransaction(call as any)
    if (rpc.Api.isSimulationError(result)) {
      throw new Error(`Reader simulation error (${method}): ${result.error}`)
    }
    const retval = (result as rpc.Api.SimulateTransactionSuccessResponse).result?.retval
    if (!retval) throw new Error(`Reader returned no value for ${method}`)
    return retval
  }

  private static addr(a: string): xdr.ScVal {
    return new Address(a).toScVal()
  }

  // ── Market reads ────────────────────────────────────────────────────────────

  /**
   * get_market(data_store, market_token) → MarketProps
   */
  async getMarket(dataStore: string, marketToken: string): Promise<MarketProps> {
    const ret = await this.sim(
      "get_market",
      Client.addr(dataStore),
      Client.addr(marketToken),
    )
    const m = decodeMap(ret)
    return {
      marketToken: decodeAddress(fieldVal(m, "market_token")),
      indexToken:  decodeAddress(fieldVal(m, "index_token")),
      longToken:   decodeAddress(fieldVal(m, "long_token")),
      shortToken:  decodeAddress(fieldVal(m, "short_token")),
    }
  }

  /**
   * get_market_pool_value_info(data_store, oracle, market_token, maximize) → PoolValueInfo
   */
  async getMarketPoolValueInfo(
    dataStore: string,
    oracle: string,
    marketToken: string,
    maximize: boolean,
  ): Promise<PoolValueInfo> {
    const ret = await this.sim(
      "get_market_pool_value_info",
      Client.addr(dataStore),
      Client.addr(oracle),
      Client.addr(marketToken),
      xdr.ScVal.scvBool(maximize),
    )
    const m = decodeMap(ret)
    return {
      poolValue:          decodeI128(fieldVal(m, "pool_value")),
      longTokenAmount:    decodeI128(fieldVal(m, "long_token_amount")),
      shortTokenAmount:   decodeI128(fieldVal(m, "short_token_amount")),
      longTokenUsd:       decodeI128(fieldVal(m, "long_token_usd")),
      shortTokenUsd:      decodeI128(fieldVal(m, "short_token_usd")),
      longPnl:            decodeI128(fieldVal(m, "long_pnl")),
      shortPnl:           decodeI128(fieldVal(m, "short_pnl")),
      netPnl:             decodeI128(fieldVal(m, "net_pnl")),
      totalBorrowingFees: decodeI128(fieldVal(m, "total_borrowing_fees")),
      impactPoolAmount:   decodeI128(fieldVal(m, "impact_pool_amount")),
    }
  }

  /**
   * get_open_interest(data_store, market_token) → (i128, i128)  [long, short]
   * The contract returns a tuple encoded as a two-element Vec.
   */
  async getOpenInterest(
    dataStore: string,
    marketToken: string,
  ): Promise<{ long: bigint; short: bigint }> {
    const ret = await this.sim(
      "get_open_interest",
      Client.addr(dataStore),
      Client.addr(marketToken),
    )
    const vec = decodeVec(ret)
    return {
      long:  decodeI128(vec[0]),
      short: decodeI128(vec[1]),
    }
  }

  /**
   * get_funding_info(data_store, market_token) → FundingInfo
   */
  async getFundingInfo(dataStore: string, marketToken: string): Promise<FundingInfo> {
    const ret = await this.sim(
      "get_funding_info",
      Client.addr(dataStore),
      Client.addr(marketToken),
    )
    const m = decodeMap(ret)
    return {
      fundingFactorPerSecond:      decodeI128(fieldVal(m, "funding_factor_per_second")),
      longFundingAmountPerSize:    decodeI128(fieldVal(m, "long_funding_amount_per_size")),
      shortFundingAmountPerSize:   decodeI128(fieldVal(m, "short_funding_amount_per_size")),
    }
  }

  // ── Position reads ──────────────────────────────────────────────────────────

  /**
   * get_account_positions(data_store, oracle, order_handler, account, page, page_size)
   * → Vec<PositionInfo>
   */
  async getAccountPositions(
    dataStore: string,
    oracle: string,
    orderHandler: string,
    account: string,
    page = 1,
    pageSize = 20,
  ): Promise<Array<PositionInfo>> {
    const ret = await this.sim(
      "get_account_positions",
      Client.addr(dataStore),
      Client.addr(oracle),
      Client.addr(orderHandler),
      Client.addr(account),
      xdr.ScVal.scvU32(page),
      xdr.ScVal.scvU32(pageSize),
    )
    return decodeVec(ret).map(decodePositionInfo)
  }

  // ── Order reads ─────────────────────────────────────────────────────────────

  /**
   * get_account_orders(data_store, order_handler, account, page, page_size)
   * → Vec<OrderProps>
   */
  async getAccountOrders(
    dataStore: string,
    orderHandler: string,
    account: string,
    page = 1,
    pageSize = 50,
  ): Promise<Array<OrderProps>> {
    const ret = await this.sim(
      "get_account_orders",
      Client.addr(dataStore),
      Client.addr(orderHandler),
      Client.addr(account),
      xdr.ScVal.scvU32(page),
      xdr.ScVal.scvU32(pageSize),
    )
    return decodeVec(ret).map(decodeOrderProps)
  }
}

// ── Network config ────────────────────────────────────────────────────────────

export const networks = {
  testnet: {
    contractId: "",
    networkPassphrase: "Test SDF Network ; September 2015",
  },
  mainnet: {
    contractId: "",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
  },
}
