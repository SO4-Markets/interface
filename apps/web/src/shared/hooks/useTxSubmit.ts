import { useCallback, useState } from "react"
import { toast } from "sonner"
import { sendAndPoll } from "@/lib/tx-builder"

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
  const toastId = toast.loading(options.loadingMessage)

  try {
    const hash = options.execute
      ? await options.execute()
      : await (async () => {
          const signedXdr = await getSignedXdr()
          const response = await sendAndPoll(signedXdr)
          return response.hash
        })()

    await options.onSuccess?.(hash)

    toast.success(options.successMessage, {
      id: toastId,
      description: options.successDescription?.(hash),
    })

    return hash
  } catch (error) {
    const message = options.onError?.(error) ?? "Transaction failed"
    toast.error(message, { id: toastId })
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

  const submit = useCallback(
    async (getSignedXdr: () => Promise<string>, options: SubmitTxOptions): Promise<string> => {
      setState({ isLoading: true, txHash: null, error: null })
      try {
        const hash = await submitTx(getSignedXdr, options)
        setState({ isLoading: false, txHash: hash, error: null })
        return hash
      } catch (error) {
        setState({
          isLoading: false,
          txHash: null,
          error: error instanceof Error ? error.message : "Transaction failed",
        })
        throw error
      }
    },
    [],
  )

  return {
    submit,
    isLoading: state.isLoading,
    txHash: state.txHash,
    error: state.error,
  }
}
