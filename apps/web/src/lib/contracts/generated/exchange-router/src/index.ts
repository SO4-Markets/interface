import { Address, xdr } from "@stellar/stellar-sdk"

export interface OrderKey {
  orderType: string
  account: string
  market: string
  index: bigint
}

export interface CreateOrderParams {
  account: string
  market: string
  collateralToken: string
  collateralAmount: bigint
  sizeDelta: bigint
  isLong: boolean
  acceptablePrice: bigint
  triggerPrice: bigint | null
  orderType: string
  executionFee: bigint
  receiveToken: string | null
}

export interface BatchOperation {
  actionType: "createOrder" | "cancelOrder"
  orderParams: CreateOrderParams | null
  cancelKey: OrderKey | null
}

// ── ScVal helpers (manual bindings until contract WASM is deployed on testnet) ──

export function i128ScVal(value: bigint): xdr.ScVal {
  return xdr.ScVal.scvI128(
    new xdr.Int128Parts({
      lo: xdr.Uint64.fromString((value & 0xffff_ffff_ffff_ffffn).toString()),
      hi: xdr.Int64.fromString((value >> 64n).toString()),
    }),
  )
}

export function u64ScVal(value: bigint): xdr.ScVal {
  return xdr.ScVal.scvU64(xdr.Uint64.fromString(value.toString()))
}

export function symbolScVal(value: string): xdr.ScVal {
  return xdr.ScVal.scvSymbol(value)
}

export function addressScVal(value: string): xdr.ScVal {
  if (/^[GC][A-Z2-7]{55}$/.test(value)) {
    return new Address(value).toScVal()
  }
  return xdr.ScVal.scvString(value)
}

export function optionalScVal<T>(value: T | null, encode: (v: T) => xdr.ScVal): xdr.ScVal {
  return value !== null ? xdr.ScVal.scvVec([encode(value)]) : xdr.ScVal.scvVoid()
}

export function createOrderArgs(params: CreateOrderParams): Array<xdr.ScVal> {
  return [
    addressScVal(params.account),
    addressScVal(params.market),
    addressScVal(params.collateralToken),
    i128ScVal(params.collateralAmount),
    i128ScVal(params.sizeDelta),
    xdr.ScVal.scvBool(params.isLong),
    i128ScVal(params.acceptablePrice),
    optionalScVal(params.triggerPrice, i128ScVal),
    symbolScVal(params.orderType),
    i128ScVal(params.executionFee),
    optionalScVal(params.receiveToken, addressScVal),
  ]
}

export function orderKeyScVal(key: OrderKey): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("account"),
      val: addressScVal(key.account),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("index"),
      val: u64ScVal(key.index),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("market"),
      val: addressScVal(key.market),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("order_type"),
      val: symbolScVal(key.orderType),
    }),
  ])
}

export function cancelOrderArgs(account: string, key: OrderKey): Array<xdr.ScVal> {
  return [addressScVal(account), orderKeyScVal(key)]
}

export interface SwapOrderParams {
  account: string
  fromToken: string
  toToken: string
  amountIn: bigint
  minAmountOut: bigint
  swapPath: Array<string>
  executionFee: bigint
}

export function swapOrderArgs(params: SwapOrderParams): Array<xdr.ScVal> {
  return [
    addressScVal(params.account),
    addressScVal(params.fromToken),
    addressScVal(params.toToken),
    i128ScVal(params.amountIn),
    i128ScVal(params.minAmountOut),
    xdr.ScVal.scvVec(params.swapPath.map(addressScVal)),
    i128ScVal(params.executionFee),
  ]
}
