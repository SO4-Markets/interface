// Stellar / Soroban contract interaction layer
// Every function here is a DUMMY — they just toast + resolve after a fake delay.
// TODO: Replace with real Stellar SDK + Soroban contract calls when contracts are deployed.
//
// Contract equivalents to build:
//   - ExchangeRouter  → createOrder (increase / decrease / swap)
//   - DataStore       → on-chain key-value config
//   - SyntheticsReader→ getMarketInfo, getPositionInfo, getOrderInfo (batched)
//   - OrderVault      → holds collateral between order creation and execution
//
// Stellar SDK: https://stellar.github.io/js-stellar-sdk/
// Soroban RPC: https://soroban.stellar.org/api

import { toast } from "sonner"
import { sorobanRpc } from "../../lib/soroban/client"
import { formatUsd } from "@/shared/lib/format"

export type IncreaseOrderParams = {
  account: string
  marketAddress: string
  collateralToken: string
  collateralAmount: number
  sizeDeltaUsd: number
  isLong: boolean
  acceptablePrice: number
  triggerPrice?: number
  orderType: "MarketIncrease" | "LimitIncrease"
  leverage: number
}

export type DecreaseOrderParams = {
  account: string
  positionKey: string
  marketAddress: string
  collateralToken: string
  collateralDeltaAmount: number
  sizeDeltaUsd: number
  isLong: boolean
  acceptablePrice: number
  triggerPrice?: number
  orderType: "MarketDecrease" | "LimitDecrease" | "StopLoss"
  receiveToken: string
}

export type SwapOrderParams = {
  account: string
  fromToken: string
  toToken: string
  amountIn: number
  minAmountOut: number
  swapPath: Array<string>
}

/** Open a long or short position */
export async function createIncreaseOrder(params: IncreaseOrderParams): Promise<string> {
  // TODO: Build and submit Soroban transaction:
  //   1. sorobanClient.prepareTransaction(increaseOrderXDR)
  //   2. wallet.signTransaction(tx)
  //   3. sorobanClient.sendTransaction(signedTx)
  //   4. poll sorobanClient.getTransaction(hash) until SUCCESS
  //   5. return txHash

  const toastId = toast.loading(
    `Opening ${params.isLong ? "Long" : "Short"} ${params.marketAddress}…`,
  )
  await fakeTxDelay()

  toast.success(
    `${params.isLong ? "Long" : "Short"} order submitted! Size: ${formatUsd(params.sizeDeltaUsd)}`,
    { id: toastId, description: "Tx: 0xDUMMY…(not real)" },
  )

  return "DUMMY_TX_HASH"
}

/** Close or reduce an open position */
export async function createDecreaseOrder(params: DecreaseOrderParams): Promise<string> {
  // TODO: Build and submit Soroban transaction:
  //   1. Encode DecreaseOrder instruction for ExchangeRouter contract
  //   2. wallet.signTransaction(tx)
  //   3. sorobanClient.sendTransaction(signedTx)
  //   4. poll until SUCCESS/FAILED
  //   5. return txHash

  const toastId = toast.loading(
    `Closing ${params.isLong ? "Long" : "Short"} ${params.marketAddress}…`,
  )
  await fakeTxDelay()

  toast.success("Position closed successfully", {
    id: toastId,
    description: "Tx: 0xDUMMY…(not real)",
  })

  return "DUMMY_TX_HASH"
}

/** Swap one token for another */
export async function createSwapOrder(params: SwapOrderParams): Promise<string> {
  // TODO: Build and submit Soroban transaction via ExchangeRouter.createSwapOrder
  //   Route through DEX liquidity pools defined in swapPath

  const toastId = toast.loading(`Swapping ${params.fromToken} → ${params.toToken}…`)
  await fakeTxDelay()

  toast.success(`Swap submitted`, {
    id: toastId,
    description: `${params.amountIn} ${params.fromToken} → ${params.minAmountOut} ${params.toToken} (not real)`,
  })

  return "DUMMY_TX_HASH"
}

/** Cancel a pending limit/trigger order */
export async function cancelOrder(_account: string, _orderKey: string): Promise<string> {
  // TODO: Call ExchangeRouter.cancelOrder(orderKey) on Soroban
  const toastId = toast.loading("Cancelling order…")
  await fakeTxDelay(800)

  toast.success("Order cancelled", { id: toastId })
  return "DUMMY_TX_HASH"
}

/** Claim accrued funding fees */
export async function claimFundingFees(
  _account: string,
  marketAddresses: Array<string>,
): Promise<string> {
  // TODO: Call ExchangeRouter.claimFundingFees on Soroban
  const toastId = toast.loading("Claiming funding fees…")
  await fakeTxDelay(1000)

  toast.success(`Funding fees claimed for ${marketAddresses.length} market(s)`, {
    id: toastId,
  })
  return "DUMMY_TX_HASH"
}

// ── Batch orders (GMX v2 pattern) ────────────────────────────────────────────
//
// GMX v2 replaced individual order txns with a single `sendBatchOrderTxn` that
// batches create/update/cancel in one multicall. On Stellar, Soroban supports
// multi-operation transactions natively — use this pattern when contracts are live.

export type BatchOrderParams = {
  createOrders?: Array<IncreaseOrderParams>
  cancelOrderKeys?: Array<string>
  // TODO: add updateOrderParams when order editing is implemented
}

/** Submit multiple order operations in a single Soroban transaction */
export async function sendBatchOrderTxn(
  _account: string,
  params: BatchOrderParams,
): Promise<string> {
  // TODO: Build a single Soroban transaction with multiple operations:
  //   const ops = [
  //     ...params.createOrders.map(buildCreateOrderOp),
  //     ...params.cancelOrderKeys.map(buildCancelOrderOp),
  //   ]
  //   const tx = new StellarSdk.TransactionBuilder(account).addOperations(ops).build()
  //   return sorobanClient.sendTransaction(await wallet.sign(tx))

  const toastId = toast.loading(
    `Submitting batch (${(params.createOrders?.length ?? 0) + (params.cancelOrderKeys?.length ?? 0)} operations)…`,
  )
  await fakeTxDelay()
  toast.success("Batch order submitted", { id: toastId, description: "Tx: DUMMY (not real)" })
  return "DUMMY_BATCH_TX_HASH"
}

// ── TP/SL sidecar orders (GMX v2 pattern) ────────────────────────────────────
//
// Sidecar orders = TP/SL decrease orders submitted in the SAME batch transaction
// as the parent increase order. The decrease orders reference the parent's position key.
// GMX v2 uses useSidecarOrdersState() to collect them before the confirmation dialog.

export type SidecarOrderParams = {
  account: string
  marketAddress: string
  collateralToken: string
  isLong: boolean
  type: "takeProfit" | "stopLoss"
  triggerPrice: number
  sizePct: number           // 0–100 — fraction of position to close on trigger
  indexToken: string
}

/** Submit a TP or SL order attached to an existing position */
export async function createSidecarOrder(params: SidecarOrderParams): Promise<string> {
  // TODO: Encode as LimitDecrease (takeProfit) or StopLossDecrease (stopLoss) order
  //   via ExchangeRouter equivalent, using the same sendBatchOrderTxn pattern
  const label = params.type === "takeProfit" ? "Take Profit" : "Stop Loss"
  const toastId = toast.loading(`Setting ${label} at ${formatUsd(params.triggerPrice)}…`)
  await fakeTxDelay(900)
  toast.success(`${label} order placed`, { id: toastId, description: "Tx: DUMMY (not real)" })
  return "DUMMY_TX_HASH"
}

// Simulates a blockchain tx round-trip
function fakeTxDelay(ms = 1500): Promise<void> {
  return new Promise((res) => setTimeout(res, ms))
}
