/**
 * apps/web/src/features/trade/hooks/usePositionActions.ts
 *
 * Shared transaction lifecycle for close-position and collateral actions
 * (OB-086).
 *
 * The tracking lives here — in the panel that owns the rows — and not inside
 * the dialogs. That is what makes dismissing a dialog safe: the dialog is only
 * a form, while the transaction keeps its state, its notification, and its
 * refresh. A dialog that owned the promise would lose both on unmount.
 *
 * Account safety: every action records the account whose position it touched
 * and re-checks the connected account before applying its result. A result that
 * arrives after the trader switched accounts invalidates nothing, so it cannot
 * repaint another account's rows or balances.
 *
 * Lifecycle stages kept distinct: wallet approval → submission → ledger
 * confirmation (this module) → order acceptance / execution / partial fill
 * (indexer, surfaced by the orders and history views). A confirmed transaction
 * is never presented as a filled order.
 */

import { useCallback, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "@workspace/ui/components/toast"
import {
  classifyTransactionFailure,
  partialSizeToRaw,
  toConstraintState,
  validateClosePayload,
  validateCollateralChange,
} from "../lib/position-constraints"
import { deriveMarkPriceUsd } from "../lib/position-risk"
import { createDecreaseOrder, createIncreaseOrder } from "../lib/stellar"
import { activeQueryNetwork } from "../lib/query-keys"
import { freshPositionKey } from "./usePositionState"
import type { PositionActionKind } from "../lib/position-refresh"
import type { CloseConstraintPayload, PositionConstraintState } from "../lib/position-constraints"
import type { Position } from "./usePositions"
import type { PositionInfo } from "@/lib/contracts"
import { syntheticsReaderClient } from "@/lib/contracts"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import { useTokenBalances } from "@/features/wallet/hooks/useTokenBalances"
import { fromSorobanAmount } from "@/shared/lib/bignum"
import { invalidateMutationOutcome } from "@/shared/lib/mutation-invalidation"

const USD_DECIMALS = 30
const TOKEN_DECIMALS = 7

/** Price buffer so a price move between submission and execution is tolerated. */
const SLIPPAGE = 0.01

export type PositionActionStatus = "pending" | "success" | "error"

export type PositionActionState = {
  kind: PositionActionKind
  status: PositionActionStatus
  positionKey: string
  /** Account whose position this action touched. */
  account: string
  txHash: string | null
  errorMessage: string | null
  /** ms since epoch. */
  startedAt: number
}

export type CollateralActionInput = {
  mode: "add" | "remove"
  /** Amount in collateral token units. */
  amount: number
}

export type UsePositionActionsResult = {
  /** Per-position action state, keyed by position key. */
  actions: Partial<Record<string, PositionActionState>>
  submitClose: (
    position: Position,
    payload: CloseConstraintPayload,
  ) => Promise<string | null>
  submitCollateral: (
    position: Position,
    input: CollateralActionInput,
  ) => Promise<string | null>
  /** Action for a position, or null when it belongs to another account. */
  getAction: (positionKey: string) => PositionActionState | null
  clearAction: (positionKey: string) => void
  isBusy: (positionKey: string) => boolean
}

/**
 * Read authoritative position state immediately before signing.
 *
 * Falls back to the displayed row when the read fails, so a transient contract
 * read never blocks a trade the trader asked for.
 */
async function readFreshConstraintState(
  account: string,
  position: Position,
): Promise<PositionConstraintState | null> {
  const rawPositions = await syntheticsReaderClient.getAccountPositions(account)
  const info = rawPositions.find(
    (p: PositionInfo) =>
      freshPositionKey(
        p.position.account,
        p.position.market,
        p.position.collateralToken,
        p.position.isLong,
      ) === position.key,
  )
  if (!info) return null

  const props = info.position
  const sizeUsd = fromSorobanAmount(props.sizeInUsd, USD_DECIMALS)
  const sizeInTokens = fromSorobanAmount(props.sizeInTokens, TOKEN_DECIMALS)
  const collateralAmount = fromSorobanAmount(props.collateralAmount, TOKEN_DECIMALS)
  const pnlUsd = fromSorobanAmount(info.pnlUsd, USD_DECIMALS)
  const entryPrice = sizeInTokens > 0 ? sizeUsd / sizeInTokens : 0
  const derivedMarkPrice = deriveMarkPriceUsd({
    entryPrice,
    sizeUsd,
    pnlUsd,
    isLong: props.isLong,
  })

  return {
    sizeUsd,
    sizeInUsdRaw: props.sizeInUsd,
    collateralAmount,
    // Collateral token price is unchanged, so scale the row's USD value by the
    // ratio between fresh and displayed token amounts.
    collateralUsd:
      position.collateralAmount > 0
        ? position.collateralUsd * (collateralAmount / position.collateralAmount)
        : position.collateralUsd,
    markPrice: derivedMarkPrice > 0 ? derivedMarkPrice : position.markPrice,
  }
}

function acceptablePrice(
  markPrice: number,
  isLong: boolean,
  direction: "close" | "add" | "remove",
): number {
  // Increase orders buy — a long is willing to pay above the mark. Decrease
  // orders sell — a short is willing to pay above the mark to buy back.
  const isIncrease = direction === "add"
  const toleranceAboveMark = isLong === isIncrease
  return toleranceAboveMark
    ? markPrice * (1 + SLIPPAGE)
    : markPrice * (1 - SLIPPAGE)
}

export function usePositionActions(): UsePositionActionsResult {
  const queryClient = useQueryClient()
  const account = useWalletStore((state) => state.address)
  const { data: balances } = useTokenBalances()
  const [actions, setActions] = useState<
    Partial<Record<string, PositionActionState>>
  >({})

  const setAction = useCallback(
    (positionKey: string, state: PositionActionState) => {
      setActions((previous) => ({ ...previous, [positionKey]: state }))
    },
    [],
  )

  const clearAction = useCallback((positionKey: string) => {
    setActions((previous) => {
      if (!(positionKey in previous)) return previous
      const next = { ...previous }
      delete next[positionKey]
      return next
    })
  }, [])

  const applyConfirmed = useCallback(
    async (
      submittedFor: string,
      positionKey: string,
      kind: PositionActionKind,
      hash: string,
      marketAddress: string,
    ) => {
      if (useWalletStore.getState().address === submittedFor) {
        const action = kind === "close" ? "close" : "collateral"
        await invalidateMutationOutcome(queryClient, action, {
          account: submittedFor,
          network: activeQueryNetwork(),
          marketAddress,
        })
      }
      setAction(positionKey, {
        kind,
        status: "success",
        positionKey,
        account: submittedFor,
        txHash: hash,
        errorMessage: null,
        startedAt: Date.now(),
      })
    },
    [queryClient, setAction],
  )

  const applyFailure = useCallback(
    (submittedFor: string, positionKey: string, kind: PositionActionKind, error: unknown) => {
      const failure = classifyTransactionFailure(error)
      // A wallet rejection is not a contract failure: say so plainly, and never
      // imply that any position state changed.
      if (failure.kind === "wallet-rejected") {
        toast.info(failure.message)
      }
      setAction(positionKey, {
        kind,
        status: "error",
        positionKey,
        account: submittedFor,
        txHash: null,
        errorMessage: failure.message,
        startedAt: Date.now(),
      })
    },
    [setAction],
  )

  const submitClose = useCallback(
    async (position: Position, payload: CloseConstraintPayload) => {
      const submittedFor = position.account
      const fresh = await readFreshConstraintState(submittedFor, position).catch(
        () => null,
      )
      const constraintState = fresh ?? toConstraintState(position)

      const validationError = validateClosePayload(payload, constraintState)
      if (validationError) {
        toast.error(validationError)
        return null
      }

      // A full close sends the authoritative total; a partial close preserves
      // the exact amount the trader entered, down to its raw on-chain form.
      const sizeDeltaUsd = payload.isFull
        ? constraintState.sizeUsd
        : payload.sizeDeltaUsd
      const sizeDeltaUsdRaw = payload.isFull
        ? constraintState.sizeInUsdRaw
        : partialSizeToRaw(payload.sizeDeltaUsd, constraintState)

      setAction(position.key, {
        kind: "close",
        status: "pending",
        positionKey: position.key,
        account: submittedFor,
        txHash: null,
        errorMessage: null,
        startedAt: Date.now(),
      })

      try {
        const hash = await createDecreaseOrder({
          account: submittedFor,
          positionKey: position.key,
          marketAddress: position.marketAddress,
          collateralToken: position.collateralToken,
          collateralDeltaAmount: 0, // 0 = let the contract return all collateral
          sizeDeltaUsd,
          ...(sizeDeltaUsdRaw !== undefined ? { sizeDeltaUsdRaw } : {}),
          isLong: position.isLong,
          acceptablePrice: acceptablePrice(
            constraintState.markPrice,
            position.isLong,
            "close",
          ),
          orderType: "MarketDecrease",
          receiveToken: position.collateralToken,
        })
        await applyConfirmed(
          submittedFor,
          position.key,
          "close",
          hash,
          position.marketAddress,
        )
        return hash
      } catch (error) {
        applyFailure(submittedFor, position.key, "close", error)
        return null
      }
    },
    [applyConfirmed, applyFailure, setAction],
  )

  const submitCollateral = useCallback(
    async (position: Position, input: CollateralActionInput) => {
      const submittedFor = position.account
      const kind: PositionActionKind =
        input.mode === "add" ? "add-collateral" : "remove-collateral"

      const fresh = await readFreshConstraintState(submittedFor, position).catch(
        () => null,
      )
      const constraintState = fresh ?? toConstraintState(position)
      const tokenPriceUsd =
        constraintState.collateralAmount > 0
          ? constraintState.collateralUsd / constraintState.collateralAmount
          : 0

      const validationError = validateCollateralChange(
        {
          mode: input.mode,
          amount: input.amount,
          tokenPriceUsd,
          walletBalance: balances?.[position.collateralToken],
        },
        constraintState,
      )
      if (validationError) {
        toast.error(validationError)
        return null
      }

      const deltaUsd = input.amount * tokenPriceUsd
      const newCollateralUsd =
        input.mode === "add"
          ? constraintState.collateralUsd + deltaUsd
          : Math.max(0, constraintState.collateralUsd - deltaUsd)
      const newLeverage =
        newCollateralUsd > 0
          ? Math.round(constraintState.sizeUsd / newCollateralUsd)
          : 0

      setAction(position.key, {
        kind,
        status: "pending",
        positionKey: position.key,
        account: submittedFor,
        txHash: null,
        errorMessage: null,
        startedAt: Date.now(),
      })

      try {
        const hash =
          input.mode === "add"
            ? await createIncreaseOrder({
                account: submittedFor,
                marketAddress: position.marketAddress,
                collateralToken: position.collateralToken,
                collateralAmount: input.amount,
                sizeDeltaUsd: 0, // collateral-only increase
                isLong: position.isLong,
                acceptablePrice: acceptablePrice(
                  constraintState.markPrice,
                  position.isLong,
                  "add",
                ),
                orderType: "MarketIncrease",
                leverage: newLeverage,
              })
            : await createDecreaseOrder({
                account: submittedFor,
                positionKey: position.key,
                marketAddress: position.marketAddress,
                collateralToken: position.collateralToken,
                collateralDeltaAmount: input.amount,
                sizeDeltaUsd: 0, // collateral-only decrease
                isLong: position.isLong,
                acceptablePrice: acceptablePrice(
                  constraintState.markPrice,
                  position.isLong,
                  "remove",
                ),
                orderType: "MarketDecrease",
                receiveToken: position.collateralToken,
              })

        await applyConfirmed(
          submittedFor,
          position.key,
          kind,
          hash,
          position.marketAddress,
        )
        return hash
      } catch (error) {
        applyFailure(submittedFor, position.key, kind, error)
        return null
      }
    },
    [applyConfirmed, applyFailure, balances, setAction],
  )

  const getAction = useCallback(
    (positionKey: string): PositionActionState | null => {
      const state = actions[positionKey]
      if (!state) return null
      // Never surface an action belonging to a different account.
      return state.account === account ? state : null
    },
    [account, actions],
  )

  const isBusy = useCallback(
    (positionKey: string) => getAction(positionKey)?.status === "pending",
    [getAction],
  )

  return { actions, submitClose, submitCollateral, getAction, clearAction, isBusy }
}
