import { useEffect, useRef, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { useWallet } from "@/app/providers"

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…`
}

export function ConnectButton({ compactMobile = false }: { compactMobile?: boolean }) {
  const { address, status, connect, disconnect } = useWallet()
  const [open, setOpen] = useState(false)
  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const connectTriggerRef = useRef<HTMLButtonElement>(null)
  const dropdownId = "wallet-account-menu"

  useEffect(() => {
    if (!walletModalOpen) {
      return
    }

    const focusableSelector =
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        setWalletModalOpen(false)
        return
      }

      if (event.key !== "Tab" || !modalRef.current) {
        return
      }

      const focusable = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      )
      if (focusable.length === 0) {
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    const firstFocusable = modalRef.current?.querySelector<HTMLElement>(focusableSelector)
    firstFocusable?.focus()

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      connectTriggerRef.current?.focus()
    }
  }, [walletModalOpen])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (open) {
      menuItemRefs.current[0]?.focus()
      return
    }

    const active = document.activeElement as HTMLElement | null
    if (active?.getAttribute("role") === "menuitem") {
      ;(document.getElementById("wallet-account-trigger") as HTMLButtonElement | null)?.focus()
    }
  }, [open])

  if (status === "connecting") {
    return (
      <Button
        disabled
        variant="outline"
        className="h-9.5 px-4 text-[13.5px]"
        aria-live="polite"
        aria-label="Connecting wallet"
      >
        <span
          className="mr-2 inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
        <span role="status">Connecting</span>
      </Button>
    )
  }

  if (status === "connected" && address) {
    return (
      <div ref={ref} className="relative">
        <Button
          id="wallet-account-trigger"
          variant="outline"
          className="h-9.5 max-w-[8.5rem] whitespace-nowrap px-3 text-[13.5px] sm:max-w-none"
          onClick={() => setOpen((v) => !v)}
          aria-label={`Wallet connected as ${shortenAddress(address)}`}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? dropdownId : undefined}
        >
          <span className="mr-1.5 inline-block size-2 rounded-full bg-green-500" />
          <span className={compactMobile ? "hidden sm:inline" : ""}>{shortenAddress(address)}</span>
          {compactMobile && (
            <span className="sm:hidden" aria-hidden="true">
              Wallet
            </span>
          )}
        </Button>
        {open && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/30 sm:hidden"
              aria-label="Close wallet menu"
              onClick={() => setOpen(false)}
            />
            <div
              id={dropdownId}
              role="menu"
              aria-labelledby="wallet-account-trigger"
              onKeyDown={(event) => {
                const items = menuItemRefs.current.filter(Boolean) as HTMLButtonElement[]
                const currentIndex = items.findIndex((item) => item === document.activeElement)

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
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border border-border bg-background py-2 shadow-xl sm:absolute sm:right-0 sm:top-full sm:mt-1 sm:w-44 sm:rounded-lg"
            >
              <div className="border-b border-border px-3 py-2">
                <p className="truncate text-xs text-muted-foreground">{address}</p>
              </div>
              <button
                ref={(node) => {
                  menuItemRefs.current[0] = node
                }}
                type="button"
                role="menuitem"
                onClick={() => {
                  void navigator.clipboard.writeText(address)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Copy address
              </button>
              <button
                ref={(node) => {
                  menuItemRefs.current[1] = node
                }}
                type="button"
                role="menuitem"
                onClick={() => { disconnect(); setOpen(false) }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Disconnect
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <>
      <Button
        ref={connectTriggerRef}
        variant="outline"
        className="h-9.5 whitespace-nowrap px-3 text-[13.5px] sm:px-4"
        onClick={() => setWalletModalOpen(true)}
        aria-label="Connect wallet"
        aria-haspopup="dialog"
        aria-expanded={walletModalOpen}
        aria-controls={walletModalOpen ? "wallet-connect-dialog" : undefined}
      >
        <span className={compactMobile ? "hidden sm:inline" : ""}>Connect</span>
        {compactMobile && (
          <span className="sm:hidden" aria-hidden="true">
            Wallet
          </span>
        )}
      </Button>

      {walletModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4"
          onClick={() => setWalletModalOpen(false)}
        >
          <div
            id="wallet-connect-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-connect-title"
            aria-describedby="wallet-connect-description"
            ref={modalRef}
            className="w-full max-w-md rounded-xl border border-border bg-background p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4">
              <h2 id="wallet-connect-title" className="text-base font-medium">
                Connect Wallet
              </h2>
              <p id="wallet-connect-description" className="text-sm text-muted-foreground">
                Choose a supported wallet to continue.
              </p>
            </div>
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
              className="mt-2 w-full"
              onClick={() => setWalletModalOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
