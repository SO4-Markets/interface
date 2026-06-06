import type { PoolMarketConfig } from "../data/markets"
import { queryClient } from "@/app/providers/QueryProvider"
import { CONTRACTS } from "@/app/config/contracts"
import { NETWORK } from "@/app/config/network"
import {
  buildApproveTransaction,
  buildCreateDepositTransaction,
  buildCreateWithdrawalTransaction,
  checkAllowance,
  parseSorobanError,
} from "@/lib/contracts"
import { prepareAndSign } from "@/lib/soroban/tx-builder"
import { sendAndPoll } from "@/lib/tx-builder"
import { walletKit } from "@/features/wallet/lib/wallet-kit"
import { queryKeys } from "@/shared/lib/query-keys"

type PoolTxResult = {
  hash: string
  expectedAmount: bigint | null
}

export type PoolTxStepStatus = "waiting" | "active" | "confirmed" | "skipped" | "failed"

export type PoolTxStepUpdate = {
  id: string
  status: PoolTxStepStatus
  txHash?: string
  message?: string
}

type PoolTxProgress = (update: PoolTxStepUpdate) => void

function ensurePoolContracts() {
  if (!CONTRACTS.depositHandler) {
    throw new Error("Deposit handler is not deployed on this network.")
  }
  if (!CONTRACTS.withdrawalHandler) {
    throw new Error("Withdrawal handler is not deployed on this network.")
  }
}

async function approveIfNeeded(args: {
  stepId: string
  token: string
  owner: string
  spender: string
  amount: bigint
  symbol: string
  onProgress?: PoolTxProgress
}) {
  if (args.amount <= 0n) return

  args.onProgress?.({
    id: args.stepId,
    status: "active",
    message: `Checking ${args.symbol} allowance...`,
  })

  const allowance = await checkAllowance(args.token, args.owner, args.spender)
  if (allowance >= args.amount) {
    args.onProgress?.({
      id: args.stepId,
      status: "skipped",
      message: `${args.symbol} allowance is already sufficient.`,
    })
    return
  }

  args.onProgress?.({
    id: args.stepId,
    status: "active",
    message: `Approve ${args.symbol} in your wallet, then wait for confirmation.`,
  })

  const tx = await buildApproveTransaction(
    args.token,
    args.owner,
    args.spender,
    args.amount,
  )
  const signedXdr = await prepareAndSign(tx, walletKit, NETWORK.networkPassphrase)
  const result = await sendAndPoll(signedXdr, { timeoutMs: 60_000 })

  args.onProgress?.({
    id: args.stepId,
    status: "confirmed",
    txHash: result.hash,
    message: `${args.symbol} approval confirmed.`,
  })
}

function invalidatePoolQueries(market: PoolMarketConfig, account: string) {
  queryClient.invalidateQueries({
    queryKey: queryKeys.pools.row(market.marketToken, account),
  })
  queryClient.invalidateQueries({ queryKey: ["tokenBalances", account] })
}

export async function submitPoolDeposit(args: {
  account: string
  market: PoolMarketConfig
  longTokenAmount: bigint
  shortTokenAmount: bigint
  minMarketTokens?: bigint
  onProgress?: PoolTxProgress
}): Promise<PoolTxResult> {
  ensurePoolContracts()

  const expected = { amount: null as bigint | null }

  try {
    await approveIfNeeded({
      stepId: "approve-long",
      token: args.market.longToken,
      owner: args.account,
      spender: CONTRACTS.depositHandler,
      amount: args.longTokenAmount,
      symbol: args.market.longSymbol,
      onProgress: args.onProgress,
    })

    await approveIfNeeded({
      stepId: "approve-short",
      token: args.market.shortToken,
      owner: args.account,
      spender: CONTRACTS.depositHandler,
      amount: args.shortTokenAmount,
      symbol: args.market.shortSymbol,
      onProgress: args.onProgress,
    })

    args.onProgress?.({
      id: "create-deposit",
      status: "active",
      message: "Creating deposit request. Confirm in your wallet.",
    })

    const built = await buildCreateDepositTransaction({
      caller: args.account,
      market: args.market.marketToken,
      initialLongToken: args.market.longToken,
      initialShortToken: args.market.shortToken,
      longTokenAmount: args.longTokenAmount,
      shortTokenAmount: args.shortTokenAmount,
      minMarketTokens: args.minMarketTokens ?? 0n,
      executionFee: 0n,
    })
    expected.amount = built.expectedGm
    const signedXdr = await prepareAndSign(built.tx, walletKit, NETWORK.networkPassphrase)
    const result = await sendAndPoll(signedXdr, { timeoutMs: 60_000 })

    args.onProgress?.({
      id: "create-deposit",
      status: "confirmed",
      txHash: result.hash,
      message: "Deposit request confirmed. Keeper execution is pending.",
    })

    invalidatePoolQueries(args.market, args.account)

    return { hash: result.hash, expectedAmount: expected.amount }
  } catch (error) {
    const message = parseSorobanError(error)
    args.onProgress?.({ id: "current", status: "failed", message })
    throw new Error(message, { cause: error })
  }
}

export async function submitPoolWithdrawal(args: {
  account: string
  market: PoolMarketConfig
  marketTokenAmount: bigint
  minLongTokenAmount?: bigint
  minShortTokenAmount?: bigint
  onProgress?: PoolTxProgress
}): Promise<PoolTxResult> {
  ensurePoolContracts()

  const expected = { long: null as bigint | null, short: null as bigint | null }

  try {
    await approveIfNeeded({
      stepId: "approve-gm",
      token: args.market.marketToken,
      owner: args.account,
      spender: CONTRACTS.withdrawalHandler,
      amount: args.marketTokenAmount,
      symbol: "GM",
      onProgress: args.onProgress,
    })

    args.onProgress?.({
      id: "create-withdrawal",
      status: "active",
      message: "Creating withdrawal request. Confirm in your wallet.",
    })

    const built = await buildCreateWithdrawalTransaction({
      caller: args.account,
      market: args.market.marketToken,
      marketTokenAmount: args.marketTokenAmount,
      minLongTokenAmount: args.minLongTokenAmount ?? 0n,
      minShortTokenAmount: args.minShortTokenAmount ?? 0n,
      executionFee: 0n,
    })
    expected.long = built.expectedLongTokens
    expected.short = built.expectedShortTokens
    const signedXdr = await prepareAndSign(built.tx, walletKit, NETWORK.networkPassphrase)
    const result = await sendAndPoll(signedXdr, { timeoutMs: 60_000 })

    args.onProgress?.({
      id: "create-withdrawal",
      status: "confirmed",
      txHash: result.hash,
      message: "Withdrawal request confirmed. Keeper execution is pending.",
    })

    invalidatePoolQueries(args.market, args.account)

    return {
      hash: result.hash,
      expectedAmount:
        expected.long == null && expected.short == null
          ? null
          : (expected.long ?? 0n) + (expected.short ?? 0n),
    }
  } catch (error) {
    const message = parseSorobanError(error)
    args.onProgress?.({ id: "current", status: "failed", message })
    throw new Error(message, { cause: error })
  }
}
