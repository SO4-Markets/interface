import { Address, xdr } from "@stellar/stellar-sdk/minimal"
import { Buffer } from "buffer"

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Mirrors Rust OrderType enum (gmx_types::OrderType).
 * Soroban encodes unit enum variants as a single-entry Map: {Symbol(name): Void}.
 */
export type OrderType =
  | "MarketSwap"
  | "LimitSwap"
  | "MarketIncrease"
  | "LimitIncrease"
  | "MarketDecrease"
  | "LimitDecrease"
  | "StopLossDecrease"
  | "Liquidation"
  | "StopIncrease"

/**
 * Mirrors Rust CreateOrderParams struct (gmx_types::CreateOrderParams).
 * Amounts are in Soroban i128 (bigint).
 */
export interface CreateOrderParams {
  /** Address that receives output tokens on close / partial close. */
  receiver: string
  /** Market token address (identifies the trading pair). */
  market: string
  /** Token used as collateral for this position. */
  initialCollateralToken: string
  /** Intermediate markets for multi-hop swaps — empty for direct orders. */
  swapPath: Array<string>
  /** Position size change in USD (30-decimal precision, i128). */
  sizeDeltaUsd: bigint
  /** Collateral token amount delta (token-native decimals, i128). */
  collateralDeltaAmount: bigint
  /** Stop/take-profit trigger price (USD, 30-decimal, i128). 0 = market order. */
  triggerPrice: bigint
  /** Worst acceptable fill price (USD, 30-decimal, i128). Used for slippage. */
  acceptablePrice: bigint
  /** Keeper execution fee (in XLM stroops, i128). */
  executionFee: bigint
  /** Minimum output token amount for swaps — 0 for position orders. */
  minOutputAmount: bigint
  orderType: OrderType
  isLong: boolean
}

/**
 * Mirrors Rust OrderKey (used to cancel / identify an order).
 * On-chain this is a BytesN<32>; we carry it as a hex string.
 */
export type OrderKey = string

// ── ScVal helpers ────────────────────────────────────────────────────────────

/** Encode a Stellar address (G… / C…) as scvAddress. */
function addr(a: string): xdr.ScVal {
  return new Address(a).toScVal()
}

/** Encode a signed 128-bit integer as scvI128. */
function i128(v: bigint): xdr.ScVal {
  const lo = v & 0xFFFFFFFFFFFFFFFFn
  const hi = v >> 64n
  return xdr.ScVal.scvI128(
    new xdr.Int128Parts({
      lo: xdr.Uint64.fromString(lo.toString()),
      hi: xdr.Int64.fromString(hi.toString()),
    }),
  )
}

/** Encode a Soroban #[contracttype] unit-enum variant. */
function enumVal(variantName: string): xdr.ScVal {
  return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(variantName)])
}

/**
 * Encode a hex-string order key as scvBytes (BytesN<32>).
 * Falls back to zero-padding if the key is shorter than 32 bytes.
 */
function orderKeyVal(hex: string): xdr.ScVal {
  const padded = (hex.startsWith("0x") ? hex.slice(2) : hex).padStart(64, "0")
  const bytes = new Uint8Array(padded.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16)
  return xdr.ScVal.scvBytes(Buffer.from(bytes))
}

// ── Argument builders ────────────────────────────────────────────────────────
// These build the *flat* XDR argument list passed to contract.call().
//
// Soroban encodes #[contracttype] structs as a lexicographically-sorted
// ScMap where each key is a ScSymbol matching the Rust field name (snake_case).

/**
 * Build the ScVal argument list for ExchangeRouter.create_order.
 * Rust signature: create_order(env, caller: Address, params: CreateOrderParams)
 *
 * Returns [callerScVal, paramsMapScVal].
 */
export function createOrderArgs(
  caller: string,
  params: CreateOrderParams,
): Array<xdr.ScVal> {
  return [addr(caller), createOrderParamsVal(params)]
}

export function createOrderParamsVal(params: CreateOrderParams): xdr.ScVal {
  // Fields must be in lexicographic order per Soroban Map encoding rules.
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("acceptable_price"),       val: i128(params.acceptablePrice) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("collateral_delta_amount"), val: i128(params.collateralDeltaAmount) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("execution_fee"),           val: i128(params.executionFee) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("initial_collateral_token"),val: addr(params.initialCollateralToken) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("is_long"),                 val: xdr.ScVal.scvBool(params.isLong) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("market"),                  val: addr(params.market) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("min_output_amount"),       val: i128(params.minOutputAmount) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("order_type"),              val: enumVal(params.orderType) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("receiver"),                val: addr(params.receiver) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("size_delta_usd"),          val: i128(params.sizeDeltaUsd) }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("swap_path"),
      val: xdr.ScVal.scvVec(params.swapPath.map(addr)),
    }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("trigger_price"),           val: i128(params.triggerPrice) }),
  ])
}

/**
 * Build the ScVal argument list for ExchangeRouter.cancel_order.
 * Rust signature: cancel_order(env, caller: Address, key: BytesN<32>)
 */
export function cancelOrderArgs(caller: string, key: OrderKey): Array<xdr.ScVal> {
  return [addr(caller), orderKeyVal(key)]
}

/**
 * Build the ScVal argument list for ExchangeRouter.claim_funding_fees.
 * Rust signature: claim_funding_fees(env, caller, markets: Vec<Address>, tokens: Vec<Address>)
 */
export function claimFundingFeesArgs(
  caller: string,
  markets: Array<string>,
  tokens: Array<string>,
): Array<xdr.ScVal> {
  return [
    addr(caller),
    xdr.ScVal.scvVec(markets.map(addr)),
    xdr.ScVal.scvVec(tokens.map(addr)),
  ]
}

export interface ClientOptions {
  contractId: string
  networkPassphrase: string
  rpcUrl: string
}

export class Client {
  public contractId: string
  public networkPassphrase: string
  public rpcUrl: string

  constructor(opts: ClientOptions) {
    this.contractId = opts.contractId
    this.networkPassphrase = opts.networkPassphrase
    this.rpcUrl = opts.rpcUrl
  }
}

// ── Network config (contractId filled at startup from env) ──────────────────

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

