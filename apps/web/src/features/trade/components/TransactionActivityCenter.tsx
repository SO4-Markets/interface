import { useState } from "react"
import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { Icon } from "@workspace/ui/components/icon"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import { usePendingActivity } from "../hooks/usePendingActivity"
import { getStellarExpertLink } from "../lib/transaction-explorer"

export function TransactionActivityCenter() {
  const account = useWalletStore((state) => state.address) ?? undefined
  const { activities, unreadCount, markRead, markAllRead, removeActivity } = usePendingActivity(account)
  const [open, setOpen] = useState(false)

  if (!account) return null

  return (
    <div className="fixed right-4 bottom-4 z-50 md:bottom-6">
      <button
        type="button"
        aria-label={`Transaction activity${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current)
          if (!open) markAllRead(account)
        }}
        className="relative min-h-11 min-w-11 rounded-full border border-border bg-surface-overlay px-3 text-sm shadow-lg"
      >
        Activity
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 rounded-full bg-primary px-1 text-10 text-primary-foreground">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          aria-label="Transaction activity"
          className="absolute right-0 bottom-14 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-surface-overlay shadow-xl"
        >
          <div className="flex min-h-11 items-center justify-between border-b border-border px-4">
            <h2 className="text-sm font-medium">Transaction activity</h2>
            {activities.length > 0 && (
              <button type="button" className="touch-target text-xs text-text-link" onClick={() => markAllRead(account)}>
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto overscroll-contain p-2" aria-live="polite">
            {activities.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-text-tertiary">No transactions yet</p>
            ) : (
              activities
                .slice()
                .sort((a, b) => b.timestamp - a.timestamp)
                .map((item) => (
                  <article
                    key={item.id}
                    className="rounded-md px-3 py-3 text-sm hover:bg-surface-hover"
                    onClick={() => markRead(item.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium capitalize">{item.activityType.replaceAll("_", " ")}</p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {item.stage === "submitting" && "Submitting transaction"}
                          {item.stage === "confirming" && "Waiting for confirmation"}
                          {item.stage === "confirmed" && "Confirmed"}
                          {item.stage === "failed" && (item.error || "Transaction failed")}
                        </p>
                      </div>
                      {item.stage === "confirmed" ? (
                        <Icon icon={Tick02Icon} className="size-4 text-success" aria-hidden="true" />
                      ) : item.stage === "failed" ? (
                        <Icon icon={Cancel01Icon} className="size-4 text-danger" aria-hidden="true" />
                      ) : null}
                    </div>
                    {item.txHash && (
                      <a
                        href={getStellarExpertLink(item.txHash, "public")}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex min-h-11 items-center text-xs text-text-link hover:underline"
                      >
                        View on Stellar Expert
                      </a>
                    )}
                    {(item.stage === "confirmed" || item.stage === "failed") && (
                      <button
                        type="button"
                        className="mt-2 min-h-11 text-xs text-text-secondary hover:text-text-primary"
                        onClick={() => removeActivity(item.id)}
                      >
                        Dismiss
                      </button>
                    )}
                  </article>
                ))
            )}
          </div>
        </section>
      )}
    </div>
  )
}
