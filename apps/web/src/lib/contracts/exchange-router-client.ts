import { Contract, TransactionBuilder, rpc } from "@stellar/stellar-sdk"
import { CONTRACTS } from "@/app/config/contracts"
import { NETWORK } from "@/app/config/network"
import { sorobanRpc } from "@/lib/soroban/client"
import {
  createOrderArgs,
  cancelOrderArgs,
  claimFundingFeesArgs,
  type CreateOrderParams,
  type OrderKey,
} from "@/lib/contracts/generated/exchange-router/src"
import type { Transaction } from "@stellar/stellar-sdk"

// Re-export so callers don't reach into the generated layer directly.
export type { CreateOrderParams, OrderKey }

// ── Internal helpers ──────────────────────────────────────────────────────────

async function buildAndSimulate(
  account: string,
  callArgs: ReturnType<typeof createOrderArgs>,
  methodName: string,
): Promise<Transaction> {
  const sourceAccount = await sorobanRpc.getAccount(account)
  const contract = new Contract(CONTRACTS.exchangeRouter)

  const tx = new TransactionBuilder(sourceAccount, {
    fee: "100",
    networkPassphrase: NETWORK.networkPassphrase,
  })
    .addOperation(contract.call(methodName, ...callArgs))
    .setTimeout(180)
    .build()

  const simulation = await sorobanRpc.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`${methodName} simulation failed: ${simulation.error}`)
  }
  return rpc.assembleTransaction(tx, simulation).build()
}

// ── Public builders ───────────────────────────────────────────────────────────

/**
 * Build a fee-assembled Soroban transaction for ExchangeRouter.create_order.
 * The caller's address is passed as the first argument (required auth).
 */
export async function buildCreateOrderTransaction(
  caller: string,
  params: CreateOrderParams,
): Promise<Transaction> {
  return buildAndSimulate(caller, createOrderArgs(caller, params), "create_order")
}

/**
 * Build a fee-assembled Soroban transaction for ExchangeRouter.cancel_order.
 */
export async function buildCancelOrderTransaction(
  caller: string,
  orderKey: OrderKey,
): Promise<Transaction> {
  return buildAndSimulate(caller, cancelOrderArgs(caller, orderKey), "cancel_order")
}

/**
 * Build a multi-operation batch transaction (all-or-nothing).
 * Operations are applied in order.
 */
export async function buildBatchOrderTransaction(
  caller: string,
  operations: Array<
    | { type: "createOrder"; params: CreateOrderParams }
    | { type: "cancelOrder"; key: OrderKey }
  >,
): Promise<Transaction> {
  const sourceAccount = await sorobanRpc.getAccount(caller)
  const contract = new Contract(CONTRACTS.exchangeRouter)

  let builder = new TransactionBuilder(sourceAccount, {
    fee: "100",
    networkPassphrase: NETWORK.networkPassphrase,
  })

  for (const op of operations) {
    if (op.type === "createOrder") {
      builder = builder.addOperation(
        contract.call("create_order", ...createOrderArgs(caller, op.params)),
      )
    } else {
      builder = builder.addOperation(
        contract.call("cancel_order", ...cancelOrderArgs(caller, op.key)),
      )
    }
  }

  const tx = builder.setTimeout(30).build()
  const simulation = await sorobanRpc.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Batch transaction simulation failed: ${simulation.error}`)
  }
  return rpc.assembleTransaction(tx, simulation).build()
}

/**
 * Build a fee-assembled Soroban transaction for ExchangeRouter.claim_funding_fees.
 * Both markets and tokens vecs must have the same length.
 */
export async function buildClaimFundingFeesTransaction(
  caller: string,
  markets: Array<string>,
  tokens: Array<string>,
): Promise<Transaction> {
  return buildAndSimulate(
    caller,
    claimFundingFeesArgs(caller, markets, tokens),
    "claim_funding_fees",
  )
}

// ── Deposit / Withdrawal builders ─────────────────────────────────────────────
// These mirror the exchange_router Rust functions but use raw XDR since the
// param structs are simpler and don't need the full ScMap treatment.

export type CreateDepositParams = {
  caller: string
  market: string
  longTokenAmount: bigint
  shortTokenAmount: bigint
  minMarketTokens?: bigint
  executionFee?: bigint
}

export type CreateWithdrawalParams = {
  caller: string
  market: string
  marketTokenAmount: bigint
  minLongTokenAmount?: bigint
  minShortTokenAmount?: bigint
  executionFee?: bigint
}

import { Address, xdr } from "@stellar/stellar-sdk"

function addr(a: string) { return new Address(a).toScVal() }
function i128(v: bigint) {
  const lo = v & 0xFFFFFFFFFFFFFFFFn
  const hi = v >> 64n
  return xdr.ScVal.scvI128(new xdr.Int128Parts({
    lo: xdr.Uint64.fromString(lo.toString()),
    hi: xdr.Int64.fromString(hi.toString()),
  }))
}

function depositParamsMap(p: CreateDepositParams): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("execution_fee"),        val: i128(p.executionFee ?? 3_000_000n) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("initial_long_token"),   val: addr(p.market) }),  // placeholder — real token from market
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("initial_short_token"),  val: addr(p.market) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("long_token_amount"),    val: i128(p.longTokenAmount) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("market"),               val: addr(p.market) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("min_market_tokens"),    val: i128(p.minMarketTokens ?? 0n) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("receiver"),             val: addr(p.caller) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("short_token_amount"),   val: i128(p.shortTokenAmount) }),
  ])
}

export async function buildCreateDepositTransaction(
  params: CreateDepositParams,
): Promise<{ tx: Transaction; expectedGm: bigint | null }> {
  const sourceAccount = await sorobanRpc.getAccount(params.caller)
  const contract = new Contract(CONTRACTS.exchangeRouter)

  const tx = new TransactionBuilder(sourceAccount, {
    fee: "100",
    networkPassphrase: NETWORK.networkPassphrase,
  })
    .addOperation(contract.call("create_deposit", addr(params.caller), depositParamsMap(params)))
    .setTimeout(180)
    .build()

  const simulation = await sorobanRpc.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`create_deposit simulation failed: ${simulation.error}`)
  }

  let expectedGm: bigint | null = null
  try {
    const retval = (simulation as rpc.Api.SimulateTransactionSuccessResponse).result?.retval
    if (retval) expectedGm = decodeI128Return(retval)
  } catch { /* best-effort */ }

  return { tx: rpc.assembleTransaction(tx, simulation).build(), expectedGm }
}

function withdrawalParamsMap(p: CreateWithdrawalParams): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("execution_fee"),          val: i128(p.executionFee ?? 3_000_000n) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("market"),                  val: addr(p.market) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("market_token_amount"),     val: i128(p.marketTokenAmount) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("min_long_token_amount"),   val: i128(p.minLongTokenAmount ?? 0n) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("min_short_token_amount"),  val: i128(p.minShortTokenAmount ?? 0n) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("receiver"),                val: addr(p.caller) }),
  ])
}

function decodeI128Return(v: xdr.ScVal): bigint | null {
  try {
    const p = v.i128()
    if (!p) return null
    const lo = BigInt(p.lo().toString())
    const hi = BigInt(p.hi().toString())
    return (hi << 64n) | lo
  } catch { return null }
}

export async function buildCreateWithdrawalTransaction(
  params: CreateWithdrawalParams,
): Promise<{ tx: Transaction; expectedLongTokens: bigint | null; expectedShortTokens: bigint | null }> {
  const sourceAccount = await sorobanRpc.getAccount(params.caller)
  const contract = new Contract(CONTRACTS.exchangeRouter)

  const tx = new TransactionBuilder(sourceAccount, {
    fee: "100",
    networkPassphrase: NETWORK.networkPassphrase,
  })
    .addOperation(contract.call("create_withdrawal", addr(params.caller), withdrawalParamsMap(params)))
    .setTimeout(180)
    .build()

  const simulation = await sorobanRpc.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`create_withdrawal simulation failed: ${simulation.error}`)
  }

  let expectedLongTokens: bigint | null = null
  let expectedShortTokens: bigint | null = null
  try {
    const retval = (simulation as rpc.Api.SimulateTransactionSuccessResponse).result?.retval
    if (retval) {
      const vec = retval.vec() ?? []
      expectedLongTokens  = decodeI128Return(vec[0])
      expectedShortTokens = decodeI128Return(vec[1])
    }
  } catch { /* best-effort */ }

  return {
    tx: rpc.assembleTransaction(tx, simulation).build(),
    expectedLongTokens,
    expectedShortTokens,
  }
}
