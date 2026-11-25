import { useCallback, useRef, useState } from "react"
import { toast } from "@workspace/ui/components/toast"
import { useTxFeedback } from "./useTxFeedback"
import { sendAndPoll } from "@/lib/tx-builder"
import { explorerTxUrl } from "@/app/config/network"
import { haptic } from "@/shared/lib/haptics"
import { assertOnlineForTransaction, OFFLINE_TRANSACTION_MESSAGE } from "@/shared/lib/network-safety"

export type SubmitTxOptions = {
  loadingMessage: string
  successMessage: string
  successDescription?: (hash: string) => string
  onSuccess?: (hash: string) => void | Promise<void>
  onError?: (error: unknown) => string
  execute?: () => Promise<string>
}

export async function submitTx(
  getSignedXdr: () => Promise<string>,
  options: SubmitTxOptions,
): Promise<string> {
  try {
    assertOnlineForTransaction()
  } catch (error) {
    const message = error instanceof Error ? error.message : OFFLINE_TRANSACTION_MESSAGE
    toast.error(message)
    throw error
  }

  const toastId = toast.loading(options.loadingMessage)

  try {
    const hash = options.execute
      ? await options.execute()
      : await (async () => {
          const signedXdr = await getSignedXdr()
          const response = await sendAndPoll(signedXdr)
          return response.hash
        })()

    const description = options.successDescription?.(hash)

    toast.success(options.successMessage, {
      id: toastId,
      description: (
        <div className="flex flex-col gap-1">
          {description && <span>{description}</span>}
          <a
            href={explorerTxUrl(hash)}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary hover:underline"
          >
            View transaction →
          </a>
        </div>
      ),
    })
    haptic("success")

    // Execute onSuccess as a side effect after transaction confirmation,
    // but don't let its errors overwrite transaction success state
    try {
      await options.onSuccess?.(hash)
    } catch (sideEffectError) {
      // Log the error but don't rewrite transaction truth
      console.error("onSuccess side effect failed:", sideEffectError)
      // Show a secondary toast for the refresh/indexing failure
      toast.info("Updating account data...", {
        description: "Your transaction succeeded. Refreshing account information.",
      })
    }

    return hash
  } catch (error) {
    const message = options.onError?.(error) ?? "Transaction failed"
    toast.error(message, { id: toastId })
    haptic("error")
    throw error
  }
}

type UseTxSubmitState = {
  isLoading: boolean
  txHash: string | null
  error: string | null
}

export function useTxSubmit() {
  const [state, setState] = useState<UseTxSubmitState>({
    isLoading: false,
    txHash: null,
    error: null,
  })
  const feedback = useTxFeedback()
  // Issue 733: Track attempt identity to detect and prevent duplicate submissions
  const attemptIdRef = useRef<string | null>(null)
  // Issue 733: Guard against double-click, Enter+click, component rerender triggering multiple submissions
  const submitInProgressRef = useRef(false)

  const submit = useCallback(
    async (getSignedXdr: () => Promise<string>, options: SubmitTxOptions): Promise<string> => {
      // Issue 733: Prevent duplicate submission (double-click, accidental Enter+click, rerender)
      if (submitInProgressRef.current) {
        throw new Error("Submission already in progress")
      }
      try {
        assertOnlineForTransaction()
      } catch (error) {
        const message = error instanceof Error ? error.message : OFFLINE_TRANSACTION_MESSAGE
        feedback.handleEvent({ type: "error", message })
        setState({ isLoading: false, txHash: null, error: message })
        throw error
      }
      submitInProgressRef.current = true

      setState({ isLoading: true, txHash: null, error: null })
      try {
        const hash = await submitTx(getSignedXdr, options)
        setState({ isLoading: false, txHash: hash, error: null })
        submitInProgressRef.current = false
        return hash
      } catch (error) {
        setState({
          isLoading: false,
          txHash: null,
          error: error instanceof Error ? error.message : "Transaction failed",
        })
        submitInProgressRef.current = false
        throw error
      }
    },
    [],
  )

  // Issue 732: Extended submit that integrates with transaction feedback controller
  const submitWithFeedback = useCallback(
    async (getSignedXdr: () => Promise<string>, options: SubmitTxOptions): Promise<string> => {
      const attemptId = `txn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      attemptIdRef.current = attemptId

      feedback.createAttempt(attemptId)

      // Issue 733: Prevent duplicate submission with attempt tracking
      if (submitInProgressRef.current) {
        feedback.handleEvent({
          type: "error",
          message: "Transaction already being submitted. Please wait.",
        })
        throw new Error("Submission already in progress")
      }
      submitInProgressRef.current = true

      try {
        feedback.handleEvent({ type: "signing", message: options.loadingMessage })

        const hash = options.execute
          ? await options.execute()
          : await (async () => {
              const signedXdr = await getSignedXdr()
              feedback.handleEvent({ type: "submitting", message: "Submitting transaction..." })

              try {
                const response = await sendAndPoll(signedXdr)
                return response.hash
              } catch (submitError) {
                // Issue 733: Unknown submission outcome — signal for status lookup
                const errorMsg = submitError instanceof Error ? submitError.message : "Submission failed"
                if (errorMsg.includes("unknown")) {
                  feedback.handleEvent({ type: "unknown_outcome" })
                }
                throw submitError
              }
            })()

        feedback.handleEvent({
          type: "submitted",
          hash,
          description: options.successDescription?.(hash),
        })

        await options.onSuccess?.(hash)

        feedback.handleEvent({
          type: "order_settled",
          message: options.successMessage,
          description: options.successDescription?.(hash),
        })
        haptic("success")

        setState({ isLoading: false, txHash: hash, error: null })
        submitInProgressRef.current = false
        return hash
      } catch (error) {
        const message = options.onError?.(error) ?? "Transaction failed"
        feedback.handleEvent({ type: "error", message })
        haptic("error")
        setState({
          isLoading: false,
          txHash: null,
          error: message,
        })
        submitInProgressRef.current = false
        throw error
      } finally {
        // Issue 733: Keep attempt ID for status lookup in case of unknown outcomes
        // Do NOT clear immediately — let status lookup use it if needed
      }
    },
    [feedback],
  )

  return {
    submit,
    // Issues 732 and 733: Extended submit with transaction feedback controller
    submitWithFeedback,
    isLoading: state.isLoading,
    txHash: state.txHash,
    error: state.error,
    feedback,
  }
}
