import { xdr } from "@stellar/stellar-sdk/minimal"

export function i128ToScVal(value: bigint): xdr.ScVal {
  return xdr.ScVal.scvI128(
    new xdr.Int128Parts({
      lo: xdr.Uint64.fromString((value & 0xFFFFFFFFFFFFFFFFn).toString()),
      hi: xdr.Int64.fromString((value >> 64n).toString()),
    }),
  )
}
