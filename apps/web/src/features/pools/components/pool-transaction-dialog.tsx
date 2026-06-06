import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { submitPoolDeposit, submitPoolWithdrawal } from "../lib/pool-transactions"
import type { PoolMarketConfig } from "../data/markets"
import type { PoolTxStepStatus, PoolTxStepUpdate } from "../lib/pool-transactions"
import { NumberInput } from "@/shared/components/NumberInput"
import { TokenIcon } from "@/shared/components/TokenIcon"
import { formatSorobanAmount, toSorobanAmount } from "@/shared/lib/bignum"
import { formatToken, formatTxHash } from "@/shared/lib/format"
import { getTokenClient } from "@/lib/contracts"

type PoolTransactionMode = "deposit" | "withdraw"

type PoolTransactionDialogProps = {
  open: boolean
  mode: PoolTransactionMode
  market: PoolMarketConfig
  account: string
  userGmBalance: bigint
  onClose: () => void
  onQueued: (tx: { mode: PoolTransactionMode; hash: string; expectedAmount: bigint | null }) => void
}

type TokenBalances = {
  long: bigint
  short: bigint
}

type TransactionStep = {
  id: string
  label: string
  description: string
  status: PoolTxStepStatus
  txHash?: string
}

const DECIMALS = 7

export function PoolTransactionDialog({
  open,
  mode,
  market,
  account,
  userGmBalance,
  onClose,
  onQueued,
}: PoolTransactionDialogProps) {
  const toastIdRef = useRef<string | number | null>(null)
  const [longAmount, setLongAmount] = useState("")
  const [shortAmount, setShortAmount] = useState("")
  const [gmAmount, setGmAmount] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [steps, setSteps] = useState<Array<TransactionStep>>([])

  const { data: tokenBalances } = useQuery<TokenBalances>({
    queryKey: ["pools", "depositBalances", market.marketToken, account],
    queryFn: async () => {
      const [long, short] = await Promise.all([
        getTokenClient(market.longToken, account).balance(account),
        getTokenClient(market.shortToken, account).balance(account),
      ])
      return { long, short }
    },
    enabled: open && mode === "deposit" && !!account,
    staleTime: 15_000,
  })

  const longRaw = useMemo(() => parseAmount(longAmount), [longAmount])
  const shortRaw = useMemo(() => parseAmount(shortAmount), [shortAmount])
  const gmRaw = useMemo(() => parseAmount(gmAmount), [gmAmount])
  const hasDepositAmount = (longRaw ?? 0n) > 0n || (shortRaw ?? 0n) > 0n
  const hasWithdrawAmount = (gmRaw ?? 0n) > 0n
  const depositBalanceError =
    mode === "deposit"
      ? (longRaw ?? 0n) > (tokenBalances?.long ?? 0n)
        ? `Insufficient ${market.longSymbol} balance.`
        : (shortRaw ?? 0n) > (tokenBalances?.short ?? 0n)
          ? `Insufficient ${market.shortSymbol} balance.`
          : null
      : null
  const withdrawBalanceError =
    mode === "withdraw" && (gmRaw ?? 0n) > userGmBalance
      ? "Insufficient GM balance."
      : null
  const parseError =
    (mode === "deposit" && (longRaw == null || shortRaw == null)) ||
    (mode === "withdraw" && gmRaw == null)
      ? "Enter amounts with no more than 7 decimal places."
      : null
  const validationError = parseError ?? depositBalanceError ?? withdrawBalanceError
  const canSubmit =
    !validationError &&
    (mode === "deposit" ? hasDepositAmount : hasWithdrawAmount) &&
    !isSubmitting

  useEffect(() => {
    if (!open) {
      setIsSubmitting(false)
      setIsComplete(false)
      setError(null)
      setSteps([])
    }
  }, [open])

  async function handleSubmit() {
    if (!canSubmit) return

    const initialSteps = getInitialSteps({
      mode,
      market,
      longTokenAmount: longRaw ?? 0n,
      shortTokenAmount: shortRaw ?? 0n,
    })

    setSteps(initialSteps)
    setIsSubmitting(true)
    setIsComplete(false)
    setError(null)
    toastIdRef.current = toast.loading(
      mode === "deposit" ? "Starting pool deposit..." : "Starting pool withdrawal...",
    )

    try {
      const result =
        mode === "deposit"
          ? await submitPoolDeposit({
              account,
              market,
              longTokenAmount: longRaw ?? 0n,
              shortTokenAmount: shortRaw ?? 0n,
              minMarketTokens: 0n,
              onProgress: updateStep,
            })
          : await submitPoolWithdrawal({
              account,
              market,
              marketTokenAmount: gmRaw ?? 0n,
              minLongTokenAmount: 0n,
              minShortTokenAmount: 0n,
              onProgress: updateStep,
            })

      onQueued({ mode, ...result })
      setIsComplete(true)
      toast.success(mode === "deposit" ? "Deposit queued" : "Withdrawal queued", {
        id: toastIdRef.current,
        description: `Final tx: ${formatTxHash(result.hash)}. Keeper execution usually completes within about 60 seconds.`,
      })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Transaction failed."
      setError(message)
      toast.error(message, { id: toastIdRef.current })
    } finally {
      setIsSubmitting(false)
      toastIdRef.current = null
    }
  }

  function updateStep(update: PoolTxStepUpdate) {
    const toastId = toastIdRef.current ?? undefined
    if (update.status === "active") {
      toast.loading(update.message ?? "Waiting for transaction confirmation...", { id: toastId })
    } else if (update.status === "confirmed") {
      toast.success(update.message ?? "Transaction confirmed", {
        id: toastId,
        description: update.txHash ? `Tx: ${formatTxHash(update.txHash)}` : undefined,
      })
    } else if (update.status === "skipped") {
      toast.info(update.message ?? "Step skipped", { id: toastId })
    } else if (update.status === "failed") {
      toast.error(update.message ?? "Transaction failed", { id: toastId })
    }

    setSteps((current) => {
      const targetId =
        update.id === "current"
          ? current.find((step) => step.status === "active")?.id
          : update.id

      if (!targetId) return current

      return current.map((step) =>
        step.id === targetId
          ? {
              ...step,
              status: update.status,
              txHash: update.txHash ?? step.txHash,
              description: update.message ?? step.description,
            }
          : step,
      )
    })
  }

  function handleClose() {
    if (isSubmitting) return
    if (isComplete) {
      setLongAmount("")
      setShortAmount("")
      setGmAmount("")
    }
    onClose()
  }

  const title = mode === "deposit" ? `Deposit ${market.label}` : `Withdraw ${market.label}`

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto overflow-x-hidden sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {mode === "deposit"
              ? "Queue a pool deposit. The keeper executes it after this transaction lands."
              : "Queue a withdrawal. The keeper returns the underlying tokens after this transaction lands."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          <div className="min-w-0 rounded-md border border-border bg-muted/30 p-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex -space-x-2">
                <TokenIcon symbol={market.longSymbol.replace(/^T/, "")} size={28} />
                <TokenIcon symbol={market.shortSymbol.replace(/^T/, "")} size={28} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{market.label}</p>
                <p className="text-xs text-muted-foreground">{market.displayName}</p>
              </div>
            </div>
          </div>

          {mode === "deposit" ? (
            <div className="space-y-3">
              <TokenAmountField
                label={market.longSymbol}
                value={longAmount}
                balance={tokenBalances?.long ?? 0n}
                onChange={setLongAmount}
                onMax={() => setLongAmount(formatSorobanAmount(tokenBalances?.long ?? 0n, DECIMALS))}
              />
              <TokenAmountField
                label={market.shortSymbol}
                value={shortAmount}
                balance={tokenBalances?.short ?? 0n}
                onChange={setShortAmount}
                onMax={() => setShortAmount(formatSorobanAmount(tokenBalances?.short ?? 0n, DECIMALS))}
              />
            </div>
          ) : (
            <TokenAmountField
              label="GM"
              value={gmAmount}
              balance={userGmBalance}
              onChange={setGmAmount}
              onMax={() => setGmAmount(formatSorobanAmount(userGmBalance, DECIMALS))}
            />
          )}

          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
            After approval and queue creation, keeper execution usually completes within about 60 seconds.
          </div>

          {steps.length > 0 ? <TransactionSteps steps={steps} /> : null}

          {validationError ? <p className="break-words text-xs text-red-500">{validationError}</p> : null}
          {error ? (
            <p className="max-h-32 overflow-y-auto break-words rounded-md border border-red-500/20 bg-red-500/5 p-2 text-xs text-red-500">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            {isComplete ? "Close" : "Cancel"}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isComplete}>
            {isComplete
              ? "Queued"
              : isSubmitting
              ? "Submitting..."
              : mode === "deposit"
                ? "Queue Deposit"
                : "Queue Withdrawal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TransactionSteps({ steps }: { steps: Array<TransactionStep> }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <p className="mb-3 text-xs font-medium text-foreground">Transaction progress</p>
      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li key={step.id} className="flex gap-3">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-medium ${
                step.status === "confirmed"
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-500"
                  : step.status === "active"
                    ? "border-primary bg-primary/10 text-primary"
                    : step.status === "failed"
                      ? "border-red-500 bg-red-500/10 text-red-500"
                      : step.status === "skipped"
                        ? "border-muted-foreground/40 text-muted-foreground"
                        : "border-border text-muted-foreground"
              }`}
            >
              {step.status === "confirmed"
                ? "OK"
                : step.status === "active"
                  ? "..."
                  : index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-foreground">{step.label}</p>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {step.status === "confirmed"
                    ? "Confirmed"
                    : step.status === "active"
                      ? "In progress"
                      : step.status === "skipped"
                        ? "Skipped"
                        : step.status === "failed"
                          ? "Failed"
                          : "Waiting"}
                </span>
              </div>
              <p className="mt-0.5 break-words text-[11px] leading-relaxed text-muted-foreground">
                {step.description}
              </p>
              {step.txHash ? (
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  Tx {formatTxHash(step.txHash)}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function TokenAmountField({
  label,
  value,
  balance,
  onChange,
  onMax,
}: {
  label: string
  value: string
  balance: bigint
  onChange: (value: string) => void
  onMax: () => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {formatToken(Number(formatSorobanAmount(balance, DECIMALS, 4)), label, { decimals: 4 })}
        </span>
      </div>
      <NumberInput
        value={value}
        onValueChange={onChange}
        onMax={onMax}
        placeholder="0.0"
        className="font-mono"
      />
    </div>
  )
}

function parseAmount(value: string): bigint | null {
  if (!value.trim()) return 0n

  try {
    const parsed = toSorobanAmount(value, DECIMALS)
    return parsed >= 0n ? parsed : null
  } catch {
    return null
  }
}

function getInitialSteps({
  mode,
  market,
  longTokenAmount,
  shortTokenAmount,
}: {
  mode: PoolTransactionMode
  market: PoolMarketConfig
  longTokenAmount: bigint
  shortTokenAmount: bigint
}): Array<TransactionStep> {
  if (mode === "withdraw") {
    return [
      {
        id: "approve-gm",
        label: "Approve GM",
        description: "Allow the withdrawal handler to spend your GM tokens.",
        status: "waiting",
      },
      {
        id: "create-withdrawal",
        label: "Create withdrawal",
        description: "Submit the withdrawal request and wait for confirmation.",
        status: "waiting",
      },
    ]
  }

  const steps: Array<TransactionStep> = []

  if (longTokenAmount > 0n) {
    steps.push({
      id: "approve-long",
      label: `Approve ${market.longSymbol}`,
      description: `Allow the deposit handler to spend ${market.longSymbol}.`,
      status: "waiting",
    })
  }

  if (shortTokenAmount > 0n) {
    steps.push({
      id: "approve-short",
      label: `Approve ${market.shortSymbol}`,
      description: `Allow the deposit handler to spend ${market.shortSymbol}.`,
      status: "waiting",
    })
  }

  steps.push({
    id: "create-deposit",
    label: "Create deposit",
    description: "Submit the deposit request and wait for confirmation.",
    status: "waiting",
  })

  return steps
}
