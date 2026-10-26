import { Address, Contract, TransactionBuilder, rpc, xdr } from "@stellar/stellar-sdk/minimal"
import type { Transaction } from "@stellar/stellar-sdk/minimal"
import {
  createOrderArgs,
  createOrderParamsVal,
  cancelOrderArgs,
  claimFundingFeesArgs,
} from "../generated/exchange-router/src"
import type { CreateOrderParams, OrderKey } from "../generated/exchange-router/src"
import type { NetworkConfig } from "../types"

export type { CreateOrderParams, OrderKey }

export type CreateDepositParams = {
  caller: string
  market: string
  initialLongToken: string
  initialShortToken: string
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

type Config = NetworkConfig & { contractId: string; orderVault?: string }

function addr(a: string): xdr.ScVal {
  return new Address(a).toScVal()
}

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

function depositParamsMap(p: CreateDepositParams): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("execution_fee"),       val: i128(p.executionFee ?? 3_000_000n) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("initial_long_token"),  val: addr(p.initialLongToken) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("initial_short_token"), val: addr(p.initialShortToken) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("long_token_amount"),   val: i128(p.longTokenAmount) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("market"),              val: addr(p.market) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("min_market_tokens"),   val: i128(p.minMarketTokens ?? 0n) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("receiver"),            val: addr(p.caller) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("short_token_amount"),  val: i128(p.shortTokenAmount) }),
  ])
}

function sendTokensParamsMap(token: string, receiver: string, amount: bigint): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("amount"), val: i128(amount) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("receiver"), val: addr(receiver) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("token"), val: addr(token) }),
  ])
}

function routerAction(variantName: string, payload: xdr.ScVal): xdr.ScVal {
  return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(variantName), payload])
}

function requiresCollateralTransfer(params: CreateOrderParams): boolean {
  return params.collateralDeltaAmount > 0n && (
    params.orderType === "MarketIncrease" ||
    params.orderType === "LimitIncrease" ||
    params.orderType === "StopIncrease" ||
    params.orderType === "MarketSwap" ||
    params.orderType === "LimitSwap"
  )
}

function withdrawalParamsMap(p: CreateWithdrawalParams): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("execution_fee"),          val: i128(p.executionFee ?? 3_000_000n) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("market"),                 val: addr(p.market) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("market_token_amount"),    val: i128(p.marketTokenAmount) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("min_long_token_amount"),  val: i128(p.minLongTokenAmount ?? 0n) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("min_short_token_amount"), val: i128(p.minShortTokenAmount ?? 0n) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("receiver"),               val: addr(p.caller) }),
  ])
}

function decodeI128Return(v: xdr.ScVal): bigint | null {
  try {
    const p = v.i128()
    if (!p) return null
    const lo = BigInt(p.lo().toString())
    const hi = BigInt(p.hi().toString())
    return (hi << 64n) | lo
  } catch {
    return null
  }
}

export class ExchangeRouterClient {
  private server: rpc.Server

  constructor(private config: Config) {
    this.server = new rpc.Server(config.rpcUrl, { allowHttp: false })
  }

  private async buildAndSimulate(
    account: string,
    callArgs: ReturnType<typeof createOrderArgs>,
    methodName: string,
  ): Promise<Transaction> {
    const sourceAccount = await this.server.getAccount(account)
    const contract = new Contract(this.config.contractId)

    const tx = new TransactionBuilder(sourceAccount, {
      fee: "100",
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(contract.call(methodName, ...callArgs))
      .setTimeout(180)
      .build()

    const simulation = await this.server.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(simulation)) {
      throw new Error(`${methodName} simulation failed: ${simulation.error}`)
    }
    return rpc.assembleTransaction(tx, simulation).build()
  }

  buildCreateOrderTransaction(caller: string, params: CreateOrderParams): Promise<Transaction> {
    if (requiresCollateralTransfer(params)) {
      return this.buildMulticallTransaction(caller, [
        this.sendTokensAction(params.initialCollateralToken, params.collateralDeltaAmount),
        routerAction("CreateOrder", createOrderParamsVal(params)),
      ])
    }

    return this.buildAndSimulate(caller, createOrderArgs(caller, params), "create_order")
  }

  buildCancelOrderTransaction(caller: string, orderKey: OrderKey): Promise<Transaction> {
    return this.buildAndSimulate(caller, cancelOrderArgs(caller, orderKey), "cancel_order")
  }

  async buildBatchOrderTransaction(
    caller: string,
    operations: Array<
      | { type: "createOrder"; params: CreateOrderParams }
      | { type: "cancelOrder"; key: OrderKey }
    >,
  ): Promise<Transaction> {
    const sourceAccount = await this.server.getAccount(caller)
    const contract = new Contract(this.config.contractId)

    const multicallActions: Array<xdr.ScVal> = []
    for (const op of operations) {
      if (op.type === "createOrder") {
        if (requiresCollateralTransfer(op.params)) {
          multicallActions.push(
            this.sendTokensAction(
              op.params.initialCollateralToken,
              op.params.collateralDeltaAmount,
            ),
          )
        }
        multicallActions.push(routerAction("CreateOrder", createOrderParamsVal(op.params)))
      } else {
        multicallActions.push(routerAction("CancelOrder", cancelOrderArgs(caller, op.key)[1]))
      }
    }

    const tx = new TransactionBuilder(sourceAccount, {
      fee: "100",
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(
        contract.call(
          "multicall",
          addr(caller),
          xdr.ScVal.scvVec(multicallActions),
        ),
      )
      .setTimeout(30)
      .build()
    const simulation = await this.server.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(simulation)) {
      throw new Error(`Batch transaction simulation failed: ${simulation.error}`)
    }
    return rpc.assembleTransaction(tx, simulation).build()
  }

  private sendTokensAction(token: string, amount: bigint): xdr.ScVal {
    const orderVault = this.config.orderVault
    if (!orderVault) {
      throw new Error("Order vault contract is required to fund create_order multicalls.")
    }

    return routerAction("SendTokens", sendTokensParamsMap(token, orderVault, amount))
  }

  private async buildMulticallTransaction(caller: string, actions: Array<xdr.ScVal>): Promise<Transaction> {
    const sourceAccount = await this.server.getAccount(caller)
    const contract = new Contract(this.config.contractId)

    const tx = new TransactionBuilder(sourceAccount, {
      fee: "100",
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(
        contract.call(
          "multicall",
          addr(caller),
          xdr.ScVal.scvVec(actions),
        ),
      )
      .setTimeout(180)
      .build()

    const simulation = await this.server.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(simulation)) {
      throw new Error(`multicall simulation failed: ${simulation.error}`)
    }
    return rpc.assembleTransaction(tx, simulation).build()
  }

  buildClaimFundingFeesTransaction(
    caller: string,
    markets: Array<string>,
    tokens: Array<string>,
  ): Promise<Transaction> {
    return this.buildAndSimulate(
      caller,
      claimFundingFeesArgs(caller, markets, tokens),
      "claim_funding_fees",
    )
  }

  async buildCreateDepositTransaction(
    params: CreateDepositParams,
  ): Promise<{ tx: Transaction; expectedGm: bigint | null }> {
    const sourceAccount = await this.server.getAccount(params.caller)
    const contract = new Contract(this.config.contractId)

    const tx = new TransactionBuilder(sourceAccount, {
      fee: "100",
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(contract.call("create_deposit", addr(params.caller), depositParamsMap(params)))
      .setTimeout(180)
      .build()

    const simulation = await this.server.simulateTransaction(tx)
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

  async buildCreateWithdrawalTransaction(
    params: CreateWithdrawalParams,
  ): Promise<{ tx: Transaction; expectedLongTokens: bigint | null; expectedShortTokens: bigint | null }> {
    const sourceAccount = await this.server.getAccount(params.caller)
    const contract = new Contract(this.config.contractId)

    const tx = new TransactionBuilder(sourceAccount, {
      fee: "100",
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(
        contract.call("create_withdrawal", addr(params.caller), withdrawalParamsMap(params)),
      )
      .setTimeout(180)
      .build()

    const simulation = await this.server.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(simulation)) {
      throw new Error(`create_withdrawal simulation failed: ${simulation.error}`)
    }

    let expectedLongTokens: bigint | null = null
    let expectedShortTokens: bigint | null = null
    try {
      const retval = (simulation as rpc.Api.SimulateTransactionSuccessResponse).result?.retval
      if (retval) {
        const vec = retval.vec() ?? []
        expectedLongTokens = decodeI128Return(vec[0])
        expectedShortTokens = decodeI128Return(vec[1])
      }
    } catch { /* best-effort */ }

    return {
      tx: rpc.assembleTransaction(tx, simulation).build(),
      expectedLongTokens,
      expectedShortTokens,
    }
  }
}
