import { useEffect, useMemo, useRef, useState } from "react"

import { QRCodeSVG } from "qrcode.react"

import { Button } from "@workspace/ui/components/button"
import { CopyButton } from "@workspace/ui/components/copy-button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"

import { createSep7ConnectUri, createSep7TransactionUri } from "../lib/sep7"
import { useBalance } from "../hooks/useBalance"
import { useWalletStore } from "../store/wallet-store"
import type { CSSProperties, ComponentProps } from "react"
import { useKeyboardShortcut } from "@/shared/hooks/useKeyboardShortcut"
import { useWallet } from "@/app/providers"
import { NETWORK } from "@/app/config/network"
import { SITE_URL } from "@/shared/lib/site-identity"

type ConnectButtonProps = Omit<
  ComponentProps<typeof Button>,
  "aria-label" | "children" | "onClick" | "type"
>

type WalletOption = {
  id: string
  name: string
  installUrl: string
}

const FREIGHTER_ID = "freighter"
const HANA_ID = "hana"
const XBULL_ID = "xbull"

const WALLET_OPTIONS: Array<WalletOption> = [
  {
    id: FREIGHTER_ID,
    name: "Freighter",
    installUrl: "https://freighter.app",
  },
  {
    id: XBULL_ID,
    name: "xBull",
    installUrl: "https://xbull.app",
  },
  {
    id: HANA_ID,
    name: "Hana",
    installUrl:
      "https://chromewebstore.google.com/detail/hana-wallet/jfdlamikmbghhapbgfoogdffldioobgl",
  },
]

async function getWalletsKit() {
  const { StellarWalletsKit } = await import("@creit.tech/stellar-wallets-kit/sdk")
  return StellarWalletsKit
}

export function ConnectButton({ className, ...props }: ConnectButtonProps) {
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false)
  const address = useWalletStore((state) => state.address)
  const status = useWalletStore((state) => state.status)
  const isConnecting = status === "connecting"
  // Issue 887: only the transition into `connected` should play the pill entrance,
  // not every render of an already-connected wallet.
  const wasConnecting = useRef(false)

  useEffect(() => {
    if (status === "connecting") {
      wasConnecting.current = true
    } else if (status !== "connected") {
      wasConnecting.current = false
    }
  }, [status])

  const justConnected = status === "connected" && wasConnecting.current

  // Must be called unconditionally — before any early return
  useKeyboardShortcut({
    key: "k",
    onKeyPress: () => setIsWalletModalOpen(true),
    enabled: !isConnecting && status !== "connected",
  })

  if (status === "connected" && address) {
    return (
      <AccountBadge
        address={address}
        animateIn={justConnected}
        className={className as string | undefined}
        {...props}
      />
    )
  }

  // Issue 887: while the kit handshake is in flight the trigger becomes an
  // aria-busy status with a single pulsing indicator, so the click has
  // immediate feedback that never shifts the surrounding layout.
  if (isConnecting) {
    return (
      <Button
        {...props}
        type="button"
        aria-label="Connecting wallet"
        aria-busy="true"
        className={cn("w-full justify-center gap-2 sm:w-auto", className)}
        disabled
      >
        <span
          className="relative inline-flex size-3.5 items-center justify-center"
          aria-hidden="true"
        >
          <span className="so4-wallet-pulse absolute inset-0 rounded-full bg-primary/20" />
          <WalletIcon className="relative size-3.5" />
        </span>
        <span role="status">Connecting</span>
      </Button>
    )
  }

  return (
    <>
      <Button
        {...props}
        type="button"
        aria-label="Connect wallet"
        className={cn("w-full sm:w-auto", className)}
        disabled={props.disabled}
        onClick={() => setIsWalletModalOpen(true)}
      >
        Connect Wallet
      </Button>

      <WalletModal open={isWalletModalOpen} onOpenChange={setIsWalletModalOpen} />
    </>
  )
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 16.5v-9Z" />
      <path d="M4 8h13" />
      <path d="M16 12h4v4h-4a2 2 0 0 1 0-4Z" />
    </svg>
  )
}

function AccountBadge({
  address,
  className,
  animateIn = false,
  ...props
}: {
  address: string
  className?: string
  animateIn?: boolean
} & Omit<ConnectButtonProps, "className">) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const balance = useBalance()
  const { disconnect } = useWallet()
  const isTestnet = NETWORK.name === "testnet"

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  return (
    <div
      ref={ref}
      data-wallet-state="connected"
      className={cn("relative", animateIn && "so4-wallet-pill")}
    >
      <Button
        {...props}
        type="button"
        variant="outline"
        aria-label={`Connected wallet ${formatAddress(address)}`}
        aria-expanded={open}
        className={cn("w-full justify-start gap-2 sm:w-auto", className)}
        onClick={() => setOpen(!open)}
      >
        <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
        <span className="font-mono">{formatAddress(address)}</span>
      </Button>

      {open && (
        <div className="absolute end-0 top-full z-50 mt-1 w-72 rounded-md border bg-popover p-3 shadow-md">
          <p className="text-xs text-muted-foreground">Connected</p>
          <p className="mt-1 truncate font-mono text-sm" title={address}>
            {address}
          </p>

          <div className="mt-3 rounded-md bg-muted/50 px-2 py-1.5 text-sm">
            <span className="text-muted-foreground">XLM Balance: </span>
            <span className="font-medium">
              {balance ? `${balance.xlm.toFixed(2)}` : "—"}
            </span>
          </div>

          <div className="mt-2 space-y-0.5">
            <CopyButton
              type="button"
              role="menuitem"
              className="w-full justify-start rounded-sm px-2 py-1.5 text-start text-sm transition-colors hover:bg-accent"
              value={address}
              label="Copy address"
              onCopied={() => setOpen(false)}
            >
              Copy Address
            </CopyButton>

            {isTestnet && (
              <a
                href="https://friendbot.stellar.org"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-sm px-2 py-1.5 text-start text-sm transition-colors hover:bg-accent"
              >
                Testnet Faucet
              </a>
            )}

            <button
              type="button"
              className="w-full rounded-sm px-2 py-1.5 text-start text-sm text-destructive transition-colors hover:bg-destructive/10"
              onClick={() => {
                disconnect()
                setOpen(false)
              }}
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function WalletModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [installWallet, setInstallWallet] = useState<WalletOption | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [availableWalletIds, setAvailableWalletIds] = useState<Set<string>>(
    () => new Set(),
  )
  const setConnected = useWalletStore((state) => state.setConnected)
  const pendingTransactionXdr = useWalletStore(
    (state) => state.pendingTransactionXdr,
  )
  const setStatus = useWalletStore((state) => state.setStatus)

  useEffect(() => {
    if (!open) return

    let cancelled = false

    getWalletsKit()
      .then((kit) => kit.refreshSupportedWallets())
      .then((wallets) => {
        if (cancelled) return

        setAvailableWalletIds(
          new Set(
            wallets
              .filter((wallet) => wallet.isAvailable)
              .map((wallet) => wallet.id),
          ),
        )
      })
      .catch(() => {
        if (!cancelled) {
          setAvailableWalletIds(new Set())
        }
      })

    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      setInstallWallet(null)
      setError(null)
    }
  }, [open])

  async function connectWallet(wallet: WalletOption) {
    if (!availableWalletIds.has(wallet.id)) {
      setInstallWallet(wallet)
      return
    }

    setError(null)
    setStatus("connecting")

    try {
      const kit = await getWalletsKit()
      kit.setWallet(wallet.id)
      const { address } = await kit.fetchAddress()
      setConnected(address, wallet.id)
      onOpenChange(false)
    } catch {
      setStatus("error")
      setError(`Could not connect ${wallet.name}. Please try again.`)
    }
  }

  const sortedWalletOptions = useMemo(
    () =>
      [...WALLET_OPTIONS].sort((a, b) => {
        const aAvailable = availableWalletIds.has(a.id)
        const bAvailable = availableWalletIds.has(b.id)

        if (aAvailable === bAvailable) return 0
        return aAvailable ? -1 : 1
      }),
    [availableWalletIds],
  )
  const sep7Uri = useMemo(() => {
    const origin =
      typeof window === "undefined" ? SITE_URL : window.location.origin
    const callbackUrl = new URL("/", origin).toString()

    if (pendingTransactionXdr) {
      return createSep7TransactionUri({
        callbackUrl,
        xdr: pendingTransactionXdr,
      })
    }

    return createSep7ConnectUri(origin)
  }, [pendingTransactionXdr])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect Wallet</DialogTitle>
          <DialogDescription>
            Choose a supported Stellar wallet to continue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {sortedWalletOptions.map((wallet, index) => {
            const isAvailable = availableWalletIds.has(wallet.id)

            return (
              <Button
                key={wallet.id}
                type="button"
                variant={isAvailable ? "default" : "outline"}
                className="so4-wallet-row w-full justify-between"
                style={{ "--wallet-stagger": index } as CSSProperties}
                onClick={() => {
                  void connectWallet(wallet)
                }}
              >
                <span>{wallet.name}</span>
                <span className="text-xs opacity-75">
                  {isAvailable ? "Detected" : "Not installed"}
                </span>
              </Button>
            )
          })}
        </div>

        {installWallet && (
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{installWallet.name} is not installed.</p>
            <p className="mt-1 text-muted-foreground">
              Install it, then return here and connect without closing this modal.
            </p>
            <Button
              type="button"
              variant="secondary"
              className="mt-3 w-full justify-center"
              onClick={() => {
                window.open(installWallet.installUrl, "_blank", "noopener,noreferrer")
              }}
            >
              Install {installWallet.name}
            </Button>
          </div>
        )}

        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="space-y-3 rounded-md border border-border p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">Use Mobile Wallet</p>
              <p className="text-sm text-muted-foreground">
                {pendingTransactionXdr
                  ? "Scan to approve the pending transaction."
                  : "Scan to connect from a mobile wallet."}
              </p>
            </div>
            <a
              className="inline-flex h-6 shrink-0 items-center justify-center rounded-md border border-border px-2 text-xs font-medium transition-colors hover:bg-input/50"
              href={sep7Uri}
            >
              Scan to connect
            </a>
          </div>

          <div className="flex justify-center rounded-md bg-popover p-4">
            <QRCodeSVG value={sep7Uri} size={168} level="M" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function formatAddress(address: string) {
  if (address.length <= 12) {
    return address
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
