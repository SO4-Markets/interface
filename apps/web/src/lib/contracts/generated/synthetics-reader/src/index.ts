import { Buffer } from "buffer"
import { Contract, rpc, xdr } from "@stellar/stellar-sdk"

if (typeof window !== "undefined") {
  window.Buffer = window.Buffer || Buffer
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface MarketInfo {
  openInterestLong: bigint
  openInterestShort: bigint
  poolAmountLong: bigint
  poolAmountShort: bigint
  borrowingFactorLong: bigint
  borrowingFactorShort: bigint
  fundingFactor: bigint
  positionFeeFactor: bigint
  maxLeverage: number
  isDisabled: boolean
}

export interface PositionInfo {
  collateralAmount: bigint
  collateralUsd: bigint
  sizeUsd: bigint
  entryPrice: bigint
  markPrice: bigint
  liquidationPrice: bigint
  leverage: number
  pnl: bigint
  pnlPercent: bigint
  fundingFeeDebt: bigint
  isLong: boolean
}

export interface OrderInfo {
  orderType: string
  account: string
  marketAddress: string
  collateralToken: string
  sizeUsd: bigint
  triggerPrice: bigint
  acceptablePrice: bigint
  isLong: boolean
  createdAt: bigint
}

export interface PoolAmounts {
  longTokenAmount: bigint
  shortTokenAmount: bigint
  poolValueUsd: bigint
}

// ── Network configs ──────────────────────────────────────────────────────────

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

// ── ScVal helpers ────────────────────────────────────────────────────────────

function i128(v: bigint): xdr.ScVal {
  return xdr.ScVal.scvI128(
    new xdr.Int128Parts({
      lo: xdr.Uint64.fromString((v & BigInt("0xFFFFFFFFFFFFFFFF")).toString()),
      hi: xdr.Int64.fromString((v >> BigInt(64)).toString()),
    }),
  )
}

function u64(v: bigint): xdr.ScVal {
  return xdr.ScVal.scvU64(xdr.Uint64.fromString(v.toString()))
}

function u32(v: number): xdr.ScVal {
  return xdr.ScVal.scvU32(v)
}

function address(a: string): xdr.ScVal {
  return xdr.ScVal.scvString(a)
}

function symbol(s: string): xdr.ScVal {
  return xdr.ScVal.scvSymbol(s)
}

// ── Client ───────────────────────────────────────────────────────────────────

export interface ClientOptions {
  contractId: string
  networkPassphrase: string
  rpcUrl: string
}

export class Client {
  private contract: Contract
  private rpcUrl: string
  private networkPassphrase: string

  constructor(opts: ClientOptions) {
    this.contract = new Contract(opts.contractId)
    this.rpcUrl = opts.rpcUrl
    this.networkPassphrase = opts.networkPassphrase
  }

  private async simulateTx(method: string, ...args: xdr.ScVal[]): Promise<xdr.ScVal> {
    const server = new rpc.Server(this.rpcUrl)
    const call = this.contract.call(method, ...args)
    const sim = await server.simulateTransaction(call, "" as any, {
      networkPassphrase: this.networkPassphrase,
    })
    if ((sim as any).error) throw new Error(`Simulation error: ${(sim as any).error}`)
    return (sim as any).results?.[0]?.retval as xdr.ScVal
  }

  private fieldVal(m: xdr.ScMapEntry[], name: string): xdr.ScVal | undefined {
    return m.find((e) => e.key().sym() === name)?.val()
  }

  private i128Val(v: xdr.ScVal | undefined): bigint {
    if (!v) return 0n
    const parts = v.i128()
    return parts ? BigInt(parts.lo().toString()) : 0n
  }

  async getMarketInfo(marketAddress: string): Promise<MarketInfo> {
    const ret = await this.simulateTx("getMarketInfo", address(marketAddress))
    const m = ret.map() ?? []
    return {
      openInterestLong: this.i128Val(this.fieldVal(m, "open_interest_long")),
      openInterestShort: this.i128Val(this.fieldVal(m, "open_interest_short")),
      poolAmountLong: this.i128Val(this.fieldVal(m, "pool_amount_long")),
      poolAmountShort: this.i128Val(this.fieldVal(m, "pool_amount_short")),
      borrowingFactorLong: this.i128Val(this.fieldVal(m, "borrowing_factor_long")),
      borrowingFactorShort: this.i128Val(this.fieldVal(m, "borrowing_factor_short")),
      fundingFactor: this.i128Val(this.fieldVal(m, "funding_factor")),
      positionFeeFactor: this.i128Val(this.fieldVal(m, "position_fee_factor")),
      maxLeverage: this.fieldVal(m, "max_leverage")?.u32() ?? 0,
      isDisabled: this.fieldVal(m, "is_disabled")?.b() ?? false,
    }
  }

  async getPositionInfo(account: string, marketAddress: string, isLong: boolean): Promise<PositionInfo> {
    const ret = await this.simulateTx(
      "getPositionInfo",
      address(account),
      address(marketAddress),
      xdr.ScVal.scvBool(isLong),
    )
    const m = ret.map() ?? []
    return {
      collateralAmount: this.i128Val(this.fieldVal(m, "collateral_amount")),
      collateralUsd: this.i128Val(this.fieldVal(m, "collateral_usd")),
      sizeUsd: this.i128Val(this.fieldVal(m, "size_usd")),
      entryPrice: this.i128Val(this.fieldVal(m, "entry_price")),
      markPrice: this.i128Val(this.fieldVal(m, "mark_price")),
      liquidationPrice: this.i128Val(this.fieldVal(m, "liquidation_price")),
      leverage: this.fieldVal(m, "leverage")?.u32() ?? 0,
      pnl: this.i128Val(this.fieldVal(m, "pnl")),
      pnlPercent: this.i128Val(this.fieldVal(m, "pnl_percent")),
      fundingFeeDebt: this.i128Val(this.fieldVal(m, "funding_fee_debt")),
      isLong: this.fieldVal(m, "is_long")?.b() ?? false,
    }
  }

  async getOrderInfo(account: string): Promise<OrderInfo[]> {
    const ret = await this.simulateTx("getOrderInfo", address(account))
    const entries = ret.vec() ?? []
    return entries.map((entry) => {
      const m = entry.map() ?? []
      return {
        orderType: this.fieldVal(m, "order_type")?.sym() ?? "",
        account: this.fieldVal(m, "account")?.str() ?? "",
        marketAddress: this.fieldVal(m, "market_address")?.str() ?? "",
        collateralToken: this.fieldVal(m, "collateral_token")?.str() ?? "",
        sizeUsd: this.i128Val(this.fieldVal(m, "size_usd")),
        triggerPrice: this.i128Val(this.fieldVal(m, "trigger_price")),
        acceptablePrice: this.i128Val(this.fieldVal(m, "acceptable_price")),
        isLong: this.fieldVal(m, "is_long")?.b() ?? false,
        createdAt: BigInt(this.fieldVal(m, "created_at")?.u64()?.toString() ?? "0"),
      }
    })
  }

  async getMarketPoolAmounts(marketAddress: string): Promise<PoolAmounts> {
    const ret = await this.simulateTx("getMarketPoolAmounts", address(marketAddress))
    const m = ret.map() ?? []
    return {
      longTokenAmount: this.i128Val(this.fieldVal(m, "long_token_amount")),
      shortTokenAmount: this.i128Val(this.fieldVal(m, "short_token_amount")),
      poolValueUsd: this.i128Val(this.fieldVal(m, "pool_value_usd")),
    }
  }
}
