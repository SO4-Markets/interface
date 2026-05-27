// Central trade state — mirrors GMX's useTradeboxState (latest release)
// Persisted to localStorage so selections survive refresh.
//
// Key changes vs old fork (useSelectedTradeOption):
//   - collaterals are now stored per-market (long/short separate) instead of one global address
//   - added `advanced` display options (show TP/SL inputs, advanced mode toggle)
//   - added `sidecarOrders` concept: TP/SL orders attached to the parent position order
//   - TODO: migrate to a full Selector context (Redux-style) using reselect + use-context-selector
//     once state complexity grows — see GMX's SyntheticsStateContext pattern

import { useCallback, useEffect, useMemo, useState } from "react"
import { MARKETS, getMarketsForIndexToken } from "../data/markets"
import { INDEX_TOKENS, STABLE_TOKENS } from "../data/tokens"

export type TradeType = "Long" | "Short" | "Swap"
export type TradeMode = "Market" | "Limit" | "Trigger"

// Sidecar (attached) TP/SL orders — placed alongside the main increase order
// TODO: implement full sidecar order creation in stellar.ts once contracts are live
export type SidecarOrder = {
  type: "takeProfit" | "stopLoss"
  triggerPrice: string
  sizePct: number             // 0–100 percent of position to close
}

// Per-market collateral selection (long and short can use different collateral tokens)
type CollateralsByMarket = Record<string, { long?: string; short?: string }>

// Advanced UI options — toggle TP/SL inline inputs and expert-mode fields
type AdvancedOptions = {
  advancedDisplay: boolean    // show extra fields (slippage, execution fee, etc.)
  limitOrTPSL: boolean        // show TP/SL as part of the order form
}

export type TradeState = {
  tradeType: TradeType
  tradeMode: TradeMode
  // Token addresses
  fromTokenAddress: string
  toTokenAddress: string         // index token for Long/Short, output token for Swap
  marketAddress: string
  // Collateral per market — GMX v2 key insight: same market can have different collateral tokens
  // for long vs short (e.g. BTC market: longs use BTC collateral, shorts use USDC)
  collaterals: CollateralsByMarket
  // Input amounts (raw string so user can type freely)
  fromAmount: string
  toAmount: string               // size input for Long/Short, receive amount for Swap
  // Leverage (1x – 50x for Long/Short)
  leverage: number
  // Trigger price (Limit / Stop-Loss orders)
  triggerPrice: string
  // Sidecar TP/SL orders attached to the parent order
  sidecarOrders: Array<SidecarOrder>
  // Advanced display toggles
  advanced: AdvancedOptions
}

const STORAGE_KEY = "so4-trade-state-v2"   // bumped from v1 (collateral shape changed)

const DEFAULT_STATE: TradeState = {
  tradeType: "Long",
  tradeMode: "Market",
  fromTokenAddress: "USDC",
  toTokenAddress: "BTC",
  marketAddress: "BTC-BTC-USDC",
  collaterals: {
    "BTC-BTC-USDC": { long: "BTC", short: "USDC" },
    "ETH-ETH-USDC": { long: "ETH", short: "USDC" },
    "XLM-XLM-USDC": { long: "XLM", short: "USDC" },
  },
  fromAmount: "",
  toAmount: "",
  leverage: 10,
  triggerPrice: "",
  sidecarOrders: [],
  advanced: { advancedDisplay: false, limitOrTPSL: false },
}

function loadFromStorage(): TradeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as TradeState) : DEFAULT_STATE
  } catch {
    return DEFAULT_STATE
  }
}

function saveToStorage(state: TradeState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore storage quota errors
  }
}

export function useTradeState() {
  const [state, setState] = useState<TradeState>(loadFromStorage)

  // Persist every change
  useEffect(() => {
    saveToStorage(state)
  }, [state])

  const update = useCallback((patch: Partial<TradeState>) => {
    setState((prev) => ({ ...prev, ...patch }))
  }, [])

  // Flags derived from state
  const tradeFlags = useMemo(
    () => ({
      isLong: state.tradeType === "Long",
      isShort: state.tradeType === "Short",
      isSwap: state.tradeType === "Swap",
      isPosition: state.tradeType !== "Swap",
      isMarket: state.tradeMode === "Market",
      isLimit: state.tradeMode === "Limit",
      isTrigger: state.tradeMode === "Trigger",
    }),
    [state.tradeType, state.tradeMode],
  )

  // Available trade modes per type (Swap can't do Trigger)
  const availableTradeModes: Array<TradeMode> = useMemo(
    () =>
      state.tradeType === "Swap"
        ? ["Market", "Limit"]
        : ["Market", "Limit", "Trigger"],
    [state.tradeType],
  )

  // Markets available for the selected index token
  const availableMarkets = useMemo(
    () => getMarketsForIndexToken(state.toTokenAddress),
    [state.toTokenAddress],
  )

  // When trade type changes, reset mode if unavailable
  const setTradeType = useCallback(
    (tradeType: TradeType) => {
      const modes: Array<TradeMode> =
        tradeType === "Swap" ? ["Market", "Limit"] : ["Market", "Limit", "Trigger"]
      const mode = modes.includes(state.tradeMode) ? state.tradeMode : modes[0]
      update({ tradeType, tradeMode: mode })
    },
    [state.tradeMode, update],
  )

  // Derived: active collateral for the current market + direction
  const collateralAddress = useMemo(() => {
    const marketCollaterals = state.collaterals[state.marketAddress]
    return tradeFlags.isLong
      ? (marketCollaterals.long ?? "USDC")
      : (marketCollaterals.short ?? "USDC")
  }, [state.collaterals, state.marketAddress, tradeFlags.isLong])

  // When index token changes, pick first available market and set default collaterals
  const setToTokenAddress = useCallback(
    (address: string) => {
      const markets = getMarketsForIndexToken(address)
      const marketAddress = markets[0]?.address ?? state.marketAddress
      const market = markets[0]

      const collaterals = { ...state.collaterals }
      collaterals[market.address] = {
        long: market.longTokenAddress,
        short: market.shortTokenAddress,
      }

      update({ toTokenAddress: address, marketAddress, collaterals })
    },
    [state.marketAddress, state.collaterals, update],
  )

  // Set collateral for the active market + direction
  const setCollateralAddress = useCallback(
    (address: string) => {
      const collaterals = { ...state.collaterals }
      collaterals[state.marketAddress] = {
        ...collaterals[state.marketAddress],
        ...(tradeFlags.isLong ? { long: address } : { short: address }),
      }
      update({ collaterals })
    },
    [state.collaterals, state.marketAddress, tradeFlags.isLong, update],
  )

  // Switch from/to tokens (for Swap)
  const switchTokens = useCallback(() => {
    update({
      fromTokenAddress: state.toTokenAddress,
      toTokenAddress: state.fromTokenAddress,
      fromAmount: state.toAmount,
      toAmount: state.fromAmount,
    })
  }, [state, update])

  // Select a position from the positions list to pre-fill the panel
  // TODO: also accept tradeMode for "Add / Remove Collateral" flows
  const setActivePosition = useCallback(
    (position: { isLong: boolean; marketAddress: string; indexToken: string; collateralToken: string }) => {
      const collaterals = { ...state.collaterals }
      collaterals[position.marketAddress] = {
        ...collaterals[position.marketAddress],
        ...(position.isLong ? { long: position.collateralToken } : { short: position.collateralToken }),
      }
      update({
        tradeType: position.isLong ? "Long" : "Short",
        toTokenAddress: position.indexToken,
        marketAddress: position.marketAddress,
        collaterals,
      })
    },
    [state.collaterals, update],
  )

  // TP/SL sidecar order setters
  // TODO: wire into createIncreaseOrder — pass sidecarOrders as attached decrease orders
  const addSidecarOrder = useCallback(
    (order: SidecarOrder) => update({ sidecarOrders: [...state.sidecarOrders, order] }),
    [state.sidecarOrders, update],
  )
  const removeSidecarOrder = useCallback(
    (index: number) =>
      update({ sidecarOrders: state.sidecarOrders.filter((_, i) => i !== index) }),
    [state.sidecarOrders, update],
  )
  const clearSidecarOrders = useCallback(() => update({ sidecarOrders: [] }), [update])

  return {
    ...state,
    collateralAddress,            // derived — always use this instead of state.collaterals directly
    tradeFlags,
    availableTradeModes,
    availableMarkets,
    indexTokens: INDEX_TOKENS,
    stableTokens: STABLE_TOKENS,
    allMarkets: MARKETS,
    // Setters
    setTradeType,
    setTradeMode: (tradeMode: TradeMode) => update({ tradeMode }),
    setFromTokenAddress: (fromTokenAddress: string) => update({ fromTokenAddress }),
    setToTokenAddress,
    setMarketAddress: (marketAddress: string) => update({ marketAddress }),
    setCollateralAddress,
    setFromAmount: (fromAmount: string) => update({ fromAmount }),
    setToAmount: (toAmount: string) => update({ toAmount }),
    setLeverage: (leverage: number) => update({ leverage }),
    setTriggerPrice: (triggerPrice: string) => update({ triggerPrice }),
    setAdvanced: (advanced: Partial<AdvancedOptions>) =>
      update({ advanced: { ...state.advanced, ...advanced } }),
    switchTokens,
    setActivePosition,
    // Sidecar TP/SL
    addSidecarOrder,
    removeSidecarOrder,
    clearSidecarOrders,
  }
}
