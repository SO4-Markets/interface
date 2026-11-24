import { cva } from "class-variance-authority"
import { cn } from "@workspace/ui/lib/utils"
import type { VariantProps } from "class-variance-authority"

const statusVariants = cva("flex items-start gap-3", {
  variants: {
    variant: {
      pending: "",
      success: "",
      confirming: "",
      failed: "",
    },
  },
})

export type TransactionStatusState =
  | { status: "signing"; label?: string }
  | { status: "submitting"; label?: string }
  | { status: "confirming"; label?: string }
  | { status: "success"; hash: string; label?: string; onExplorer?: () => void }
  | { status: "failed"; error: string; label?: string; onRetry?: () => void }

type Props = {
  state: TransactionStatusState
  className?: string
}

function StatusIcon({ status }: { status: TransactionStatusState["status"] }) {
  switch (status) {
    case "signing":
      return (
        <div
          className="mt-0.5 size-4 shrink-0 motion-safe:animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )
    case "submitting":
      return (
        <div
          className="mt-0.5 size-4 shrink-0 motion-safe:animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )
    case "confirming":
      return (
        <div
          className="mt-0.5 size-4 shrink-0 motion-safe:animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )
    case "success":
      return (
        <svg
          className="mt-0.5 size-4 shrink-0 text-green-500"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M5 8l2 2 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case "failed":
      return (
        <svg
          className="mt-0.5 size-4 shrink-0 text-destructive"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M5.5 5.5l5 5M10.5 5.5l-5 5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )
  }
}

function StatusContent({ state }: { state: TransactionStatusState }) {
  switch (state.status) {
    case "signing":
      return (
        <div role="status" aria-live="polite" className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            {state.label ?? "Waiting for signature..."}
          </span>
        </div>
      )
    case "submitting":
      return (
        <div role="status" aria-live="polite" className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            {state.label ?? "Submitting transaction..."}
          </span>
        </div>
      )
    case "confirming":
      return (
        <div role="status" aria-live="polite" className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            {state.label ?? "Confirming transaction..."}
          </span>
        </div>
      )
    case "success":
      return (
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-sm font-medium text-green-500">
            {state.label ?? "Transaction confirmed"}
          </span>
          <span className="truncate font-mono text-xs text-muted-foreground">{state.hash}</span>
          {state.onExplorer && (
            <button
              onClick={state.onExplorer}
              className="w-fit text-xs text-primary hover:underline"
            >
              View on explorer →
            </button>
          )}
        </div>
      )
    case "failed":
      return (
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-sm font-medium text-destructive">
            {state.label ?? "Transaction failed"}
          </span>
          <p className="text-sm text-destructive/80">{state.error}</p>
          {state.onRetry && (
            <button
              onClick={state.onRetry}
              className="w-fit text-xs text-primary hover:underline"
            >
              Retry transaction
            </button>
          )}
        </div>
      )
  }
}

export function TransactionStatus({ state, className }: Props) {
  return (
    <div className={cn(statusVariants(), className)}>
      <StatusIcon status={state.status} />
      <StatusContent state={state} />
    </div>
  )
}
