import { toSorobanAmount } from "@/shared/lib/bignum"
import { getMarket } from "../data/markets"
import { getToken } from "../data/tokens"
import type { CreateOrderParams, SwapOrderParams as ContractSwapParams } from "@/lib/contracts/generated/exchange-router/src"
import type { IncreaseOrderParams, DecreaseOrderParams, SwapOrderParams } from "./stellar"

const USD_DECIMALS = 30
const XLM_DECIMALS = 7
const DEFAULT_EXECUTION_FEE_XLM = 0.3

const TOKEN_DECIMALS: Record<string, number> = {
  BTC: 8,
  ETH: 18,
  XLM: 7,
  USDC: 7,
  USDT: 7,
}

/** GMX-style on-chain price: usdPrice × 10^(30 − indexTokenDecimals). */
export function encodeOraclePrice(usdPrice: number, indexToken: string): bigint {
  const tokenDecimals = TOKEN_DECIMALS[indexToken] ?? 18
  const scaleDecimals = Math.max(0, USD_DECIMALS - tokenDecimals)
  return toSorobanAmount(usdPrice, scaleDecimals)
}

export function encodeUsdAmount(usd: number): bigint {
  return toSorobanAmount(usd, USD_DECIMALS)
}

export function encodeTokenAmount(amount: number, tokenSymbol: string): bigint {
  const decimals = getToken(tokenSymbol)?.decimals ?? TOKEN_DECIMALS[tokenSymbol] ?? 7
  return toSorobanAmount(amount, decimals)
}

export function encodeExecutionFeeXlm(xlm = DEFAULT_EXECUTION_FEE_XLM): bigint {
  return toSorobanAmount(xlm, XLM_DECIMALS)
}

/** Map UI increase-order params to ExchangeRouter.createOrder contract params. */
export function toCreateOrderParams(params: IncreaseOrderParams): CreateOrderParams {
  const market = getMarket(params.marketAddress)
  const indexToken = market?.indexTokenAddress ?? params.marketAddress

  const triggerPrice =
    params.orderType === "LimitIncrease" && params.triggerPrice != null
      ? encodeOraclePrice(params.triggerPrice, indexToken)
      : null

  return {
    account: params.account,
    market: params.marketAddress,
    collateralToken: params.collateralToken,
    collateralAmount: encodeTokenAmount(params.collateralAmount, params.collateralToken),
    sizeDelta: encodeUsdAmount(params.sizeDeltaUsd),
    isLong: params.isLong,
    acceptablePrice: encodeOraclePrice(params.acceptablePrice, indexToken),
    triggerPrice,
    orderType: params.orderType,
    executionFee: encodeExecutionFeeXlm(),
    receiveToken: null,
  }
}

/** Map UI decrease-order params to ExchangeRouter.createOrder contract params. */
export function toDecreaseOrderParams(params: DecreaseOrderParams): CreateOrderParams {
  const market = getMarket(params.marketAddress)
  const indexToken = market?.indexTokenAddress ?? params.marketAddress

  const triggerPrice =
    params.triggerPrice != null
      ? encodeOraclePrice(params.triggerPrice, indexToken)
      : null

  return {
    account: params.account,
    market: params.marketAddress,
    collateralToken: params.collateralToken,
    collateralAmount: encodeTokenAmount(params.collateralDeltaAmount, params.collateralToken),
    sizeDelta: encodeUsdAmount(params.sizeDeltaUsd),
    isLong: params.isLong,
    acceptablePrice: encodeOraclePrice(params.acceptablePrice, indexToken),
    triggerPrice,
    orderType: params.orderType,
    executionFee: encodeExecutionFeeXlm(),
    receiveToken: params.receiveToken,
  }
}

/** Map UI swap-order params to ExchangeRouter.createSwapOrder contract params. */
export function toSwapOrderParams(params: SwapOrderParams): ContractSwapParams {
  return {
    account: params.account,
    fromToken: params.fromToken,
    toToken: params.toToken,
    amountIn: encodeTokenAmount(params.amountIn, params.fromToken),
    minAmountOut: encodeTokenAmount(params.minAmountOut, params.toToken),
    swapPath: params.swapPath,
    executionFee: encodeExecutionFeeXlm(),
  }
}
