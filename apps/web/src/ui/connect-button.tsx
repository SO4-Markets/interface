import { useEffect, useRef, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { CopyButton } from "@workspace/ui/components/copy-button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { useWallet } from "@/app/providers"

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…`
}

export function ConnectButton({
  compactMobile = false,
}: {
  compactMobile?: boolean
}) {
  const { address, status, connect, disconnect } = useWallet()
  const [open, setOpen] = useState(false)
  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const dropdownId = "wallet-account-menu"

  // Close the account dropdown when a click lands outside it
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Focus the first menu item when the dropdown opens; restore focus when it
  // closes (base-ui Dialog handles this for the modal, so we only need it here
  // for the non-modal account dropdown).
  useEffect(() => {
    if (open) {
      menuItemRefs.current[0]?.focus()
      return
    }

    const active = document.activeElement as HTMLElement | null
    if (active?.getAttribute("role") === "menuitem") {
      ;(
        document.getElementById(
          "wallet-account-trigger"
        ) as HTMLButtonElement | null
      )?.focus()
    }
  }, [open])

  // ── Connecting state ────────────────────────────────────────────────────────

  if (status === "connecting") {
    return (
      <Button
        disabled
        variant="outline"
        className="h-9.5 px-4 text-13-5"
        aria-live="polite"
        aria-label="Connecting wallet"
      >
        <span
          className="me-2 inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
        <span role="status">Connecting</span>
      </Button>
    )
  }

  // ── Connected state — account badge + dropdown menu ─────────────────────────

  if (status === "connected" && address) {
    return (
      <div ref={ref} className="relative">
        <Button
          id="wallet-account-trigger"
          variant="outline"
          className="h-9.5 max-w-34 whitespace-nowrap px-3 text-13-5 sm:max-w-none"
          onClick={() => setOpen((v) => !v)}
          aria-label={`Wallet connected as ${shortenAddress(address)}`}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? dropdownId : undefined}
        >
          <span className="me-1.5 inline-block size-2 rounded-full bg-green-500" />
          <span className={compactMobile ? "hidden sm:inline" : ""}>
            {shortenAddress(address)}
          </span>
          {compactMobile && (
            <span className="sm:hidden" aria-hidden="true">
              Wallet
            </span>
          )}
        </Button>

        {open && (
          <>
            {/* Mobile backdrop */}
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/30 sm:hidden"
              aria-label="Close wallet menu"
              onClick={() => setOpen(false)}
            />

            {/* Dropdown menu */}
            <div
              id={dropdownId}
              role="menu"
              aria-labelledby="wallet-account-trigger"
              onKeyDown={(event) => {
                const items = menuItemRefs.current.filter(
                  Boolean
                ) as Array<HTMLButtonElement>
                const currentIndex = items.findIndex(
                  (item) => item === document.activeElement
                )

                if (event.key === "Escape") {
                  event.preventDefault()
                  setOpen(false)
                  return
                }

                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault()
                  if (items.length === 0) return
                  const delta = event.key === "ArrowDown" ? 1 : -1
                  const nextIndex =
                    currentIndex === -1
                      ? 0
                      : (currentIndex + delta + items.length) % items.length
                  items[nextIndex]?.focus()
                  return
                }

                if (event.key === "Enter" && currentIndex >= 0) {
                  event.preventDefault()
                  items[currentIndex]?.click()
                }
              }}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border border-border bg-background py-2 shadow-xl sm:absolute sm:top-full sm:inset-inline-end-0 sm:mt-1 sm:w-44 sm:rounded-lg"
            >
              <div className="border-b border-border px-3 py-2">
                <p className="truncate text-xs text-muted-foreground">
                  {address}
                </p>
              </div>
              <CopyButton
                ref={(node) => {
                  menuItemRefs.current[0] = node
                }}
                type="button"
                role="menuitem"
                value={address}
                label="Copy address"
                onCopied={() => setOpen(false)}
                className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Copy address
              </CopyButton>
              <button
                ref={(node) => {
                  menuItemRefs.current[1] = node
                }}
                type="button"
                role="menuitem"
                onClick={() => {
                  disconnect()
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Disconnect
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  // ── Disconnected state — connect trigger + Dialog ───────────────────────────

  return (
    <>
      <Button
        variant="outline"
        className="h-9.5 whitespace-nowrap px-3 text-13-5 sm:px-4"
        onClick={() => setWalletModalOpen(true)}
        aria-label="Connect wallet"
        aria-haspopup="dialog"
        aria-expanded={walletModalOpen}
      >
        <span className={compactMobile ? "hidden sm:inline" : ""}>Connect</span>
        {compactMobile && (
          <span className="sm:hidden" aria-hidden="true">
            Wallet
          </span>
        )}
      </Button>

      {/*
       * Focus trap, Escape-to-close, aria-modal, aria-labelledby, and
       * aria-describedby are all managed by the @base-ui/react Dialog
       * primitive — no manual event listeners needed here.
       */}
      <Dialog open={walletModalOpen} onOpenChange={setWalletModalOpen}>
        <DialogContent
          data-testid="wallet-connect-dialog"
          className="sm:max-w-sm"
        >
          <DialogHeader>
            <DialogTitle>Connect Wallet</DialogTitle>
            <DialogDescription>
              Choose a supported wallet to continue.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                connect()
                setWalletModalOpen(false)
              }}
            >
              Freighter
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setWalletModalOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
