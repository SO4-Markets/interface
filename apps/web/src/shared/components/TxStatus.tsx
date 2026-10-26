import { parseSorobanError } from "@workspace/contracts/errors"
import { explorerTxUrl } from "@/app/config/network"

export type TxStatusState =
  | { status: "pending" }
  | { status: "success"; hash: string }
  | { status: "failed"; error: unknown }

type Props = {
  state: TxStatusState
  className?: string
}

export function TxStatus({ state, className }: Props) {
  return (
    <div className={`flex items-start gap-3 ${className ?? ""}`}>
      {state.status === "pending" && <Pending />}
      {state.status === "success" && <Success hash={state.hash} />}
      {state.status === "failed" && <Failed error={state.error} />}
    </div>
  )
}

function Pending() {
  return (
    <>
      <span
        className="mt-0.5 size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
        aria-hidden="true"
      />
      <span className="text-sm">Waiting for confirmation…</span>
    </>
  )
}

function Success({ hash }: { hash: string }) {
  return (
    <>
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
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-green-500">Transaction confirmed</span>
        <span className="truncate font-mono text-xs text-muted-foreground">{hash}</span>
        <a
          href={explorerTxUrl(hash)}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary hover:underline"
        >
          View on Stellar Expert →
        </a>
      </div>
    </>
  )
}

function Failed({ error }: { error: unknown }) {
  return (
    <>
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
      <span className="text-sm text-destructive">{parseSorobanError(error)}</span>
    </>
  )
}
