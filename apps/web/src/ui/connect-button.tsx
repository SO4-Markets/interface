import { useEffect, useRef, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { useWallet } from "@/app/providers"

function shortenAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

export function ConnectButton() {
  const { address, status, connect, disconnect } = useWallet()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  if (status === "connecting") {
    return (
      <Button disabled variant="outline" className="h-9.5 px-4 text-[13.5px]">
        <span className="mr-2 inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        Connecting
      </Button>
    )
  }

  if (status === "connected" && address) {
    return (
      <div ref={ref} className="relative">
        <Button
          variant="outline"
          className="h-9.5 px-3 text-[13.5px]"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="mr-1.5 inline-block size-2 rounded-full bg-green-500" />
          {shortenAddress(address)}
        </Button>
        {open && (
          <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-border bg-background py-1 shadow-md">
            <div className="border-b border-border px-3 py-2">
              <p className="truncate text-xs text-muted-foreground">{address}</p>
            </div>
            <button
              onClick={() => { disconnect(); setOpen(false) }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <Button variant="outline" className="h-9.5 px-4 text-[13.5px]" onClick={connect}>
      Connect
    </Button>
  )
}
