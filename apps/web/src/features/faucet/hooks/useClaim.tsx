import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { FAUCET_TOKENS } from "../data/tokens"
import { createFaucetClient } from "../lib/clients"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import { walletKit } from "@/features/wallet/lib/wallet-kit"
import { sendAndPoll } from "@/lib/tx-builder"
import { explorerTxUrl } from "@/app/config/network"
import { queryKeys } from "@/shared/lib/query-keys"
import { parseSorobanError } from "@/lib/contracts"

function isClaimTooSoonError(error: unknown): boolean {
  const text = String(error).toLowerCase()
  return (
    text.includes("claimtoosoon") ||
    text.includes("claim_too_soon") ||
    // contract error code 6 may appear as '#6' or 'Error(Contract, #6)'
    /error\(contract,\s*#6\)/i.test(String(error))
  )
}

type ClaimStatus = "idle" | "pending" | "success" | "error"

export type TokenClaimState = {
  status: ClaimStatus
  message?: string
}

const IDLE_CLAIM_STATE: TokenClaimState = { status: "idle" }

export function useClaim() {
  const address = useWalletStore((state) => state.address)
  const isConnected = useWalletStore((state) => state.status === "connected")
  const queryClient = useQueryClient()
  const [pendingTokenIds, setPendingTokenIds] = useState<Set<string>>(
    () => new Set()
  )
  const pendingTokenIdsRef = useRef<Set<string>>(new Set())
  const isBulkPendingRef = useRef(false)
  const [isBulkPending, setIsBulkPending] = useState(false)
  const [tokenClaimStates, setTokenClaimStates] = useState<
    Record<string, TokenClaimState>
  >({})

  const setBulkPending = useCallback((value: boolean) => {
    isBulkPendingRef.current = value
    setIsBulkPending(value)
  }, [])

  const markTokensPending = useCallback((tokenIds: Array<string>) => {
    const next = new Set(pendingTokenIdsRef.current)
    tokenIds.forEach((tokenId) => next.add(tokenId))
    pendingTokenIdsRef.current = next
    setPendingTokenIds(next)
  }, [])

  const clearTokensPending = useCallback((tokenIds: Array<string>) => {
    const next = new Set(pendingTokenIdsRef.current)
    tokenIds.forEach((tokenId) => next.delete(tokenId))
    pendingTokenIdsRef.current = next
    setPendingTokenIds(next)
  }, [])

  const setTokensClaimState = useCallback(
    (tokenIds: Array<string>, state: TokenClaimState) => {
      setTokenClaimStates((current) => {
        const next = { ...current }
        tokenIds.forEach((tokenId) => {
          next[tokenId] = state
        })
        return next
      })
    },
    []
  )

  const getTokenClaimState = useCallback(
    (tokenId: string) => tokenClaimStates[tokenId] ?? IDLE_CLAIM_STATE,
    [tokenClaimStates]
  )

  const isTokenPending = useCallback(
    (tokenId: string) => pendingTokenIds.has(tokenId),
    [pendingTokenIds]
  )

  const hasPendingTokens = pendingTokenIds.size > 0

  const claim = useCallback(
    async (tokenIds = FAUCET_TOKENS.map((token) => token.contractId)) => {
      if (!address || !isConnected) return

      const isBulkClaim = tokenIds.length !== 1
      const hasPendingToken = tokenIds.some((tokenId) =>
        pendingTokenIdsRef.current.has(tokenId)
      )
      if (
        isBulkClaim
          ? isBulkPendingRef.current || hasPendingToken
          : hasPendingToken
      )
        return

      if (isBulkClaim) {
        setBulkPending(true)
      }
      markTokensPending(tokenIds)
      setTokensClaimState(tokenIds, { status: "pending" })
      const toastId = toast.loading(
        tokenIds.length === 1 ? "Claiming test token…" : "Claiming test tokens…"
      )

      try {
        const faucet = createFaucetClient(address)
        const tx = await faucet.claim_many({
          account: address,
          tokens: tokenIds,
        })

        const unsignedXdr = tx.toXDR()
        const { signedTxXdr } = await walletKit.signTransaction(unsignedXdr)
        const signedXdr = signedTxXdr
        const { hash } = await sendAndPoll(signedXdr)

        // Refresh balances after a successful claim
        await queryClient.invalidateQueries({
          queryKey: queryKeys.faucet.data(address),
        })

        setTokensClaimState(tokenIds, {
          status: "success",
          message: "Claim submitted. Balance refreshes shortly.",
        })

        toast.success("Test tokens claimed!", {
          id: toastId,
          description: (
            <a
              href={explorerTxUrl(hash)}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline"
            >
              View transaction →
            </a>
          ),
        })
      } catch (error) {
        const message = isClaimTooSoonError(error)
          ? "Cooldown active — please wait before claiming again."
          : parseSorobanError(error)

        setTokensClaimState(tokenIds, { status: "error", message })
        toast.error(message, { id: toastId })
      } finally {
        if (isBulkClaim) {
          setBulkPending(false)
        }
        clearTokensPending(tokenIds)
      }
    },
    [
      address,
      clearTokensPending,
      isConnected,
      markTokensPending,
      queryClient,
      setBulkPending,
      setTokensClaimState,
    ]
  )

  return {
    claim,
    isBulkPending,
    isTokenPending,
    hasPendingTokens,
    getTokenClaimState,
  }
}
