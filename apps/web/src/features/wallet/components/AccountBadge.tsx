import { useEffect, useRef, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { toast } from "sonner"

import { cn } from "@workspace/ui/lib/utils"
import { useBalance } from "../hooks/useBalance"
import { useNetwork } from "../hooks/useNetwork"
import { useWallet } from "../hooks/useWallet"
import type { ComponentProps } from "react"
import { explorerAccountUrl } from "@/app/config/network"
import { formatAddress } from "@/shared/lib/format"

type AccountBadgeProps = {
  address: string
  className?: string
} & Omit<ComponentProps<typeof Button>, "className">

export function AccountBadge({ address, className, ...props }: AccountBadgeProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { disconnect } = useWallet()
  const balanceData = useBalance()
  const balance = balanceData?.xlm
  const isLoading = balanceData?.isLoading ?? false
  const { isMainnet } = useNetwork()

  useEffect(() => {
    if (!open) return

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      toast.success("Address copied")
      setOpen(false)
    } catch {
      toast.error("Failed to copy address")
    }
  }

  const handleDisconnect = () => {
    disconnect()
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <Button
        {...props}
        type="button"
        variant="outline"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn("w-full justify-start gap-2 sm:w-auto", className)}
      >
        <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
        <span className="font-mono">{formatAddress(address)}</span>
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-88 min-w-[16rem] rounded-2xl border border-border bg-background p-4 shadow-xl">
          <div className="mb-3 rounded-2xl border border-border/70 bg-muted p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  Wallet address
                </p>
                <p className="mt-2 wrap-break-word font-mono text-sm">{address}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="whitespace-nowrap"
                onClick={handleCopy}
              >
                Copy
              </Button>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted p-3">
              <span className="text-muted-foreground">Network</span>
              <span>{isMainnet ? "Mainnet" : "Testnet"}</span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted p-3">
              <span className="text-muted-foreground">XLM balance</span>
              <span>{isLoading ? "Loading…" : balance == null ? "—" : `${balance} XLM`}</span>
            </div>

            <a
              href={explorerAccountUrl(address)}
              target="_blank"
              rel="noreferrer"
              className="block rounded-xl border border-border/70 bg-muted px-3 py-2 text-sm text-primary transition hover:bg-muted/80"
            >
              View on Explorer
            </a>

            <Button type="button" variant="destructive" className="w-full" onClick={handleDisconnect}>
              Disconnect
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
