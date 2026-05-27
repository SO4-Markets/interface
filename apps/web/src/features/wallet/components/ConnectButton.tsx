import { useState, type ComponentProps } from "react"
import { FREIGHTER_ID } from "@creit.tech/stellar-wallets-kit/modules/freighter.module"
import { HANA_ID } from "@creit.tech/stellar-wallets-kit/modules/hana.module"
import { XBULL_ID } from "@creit.tech/stellar-wallets-kit/modules/xbull.module"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"

import { useWalletStore } from "../store/wallet-store"

type ConnectButtonProps = Omit<
  ComponentProps<typeof Button>,
  "aria-label" | "children" | "onClick" | "type"
>

type WalletOption = {
  id: string
  name: string
  installUrl: string
}

const WALLET_OPTIONS: WalletOption[] = [
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

export function ConnectButton({ className, ...props }: ConnectButtonProps) {
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false)
  const address = useWalletStore((state) => state.address)
  const status = useWalletStore((state) => state.status)
  const isConnecting = status === "connecting"

  if (status === "connected" && address) {
    return <AccountBadge address={address} className={className} {...props} />
  }

  return (
    <>
      <Button
        {...props}
        type="button"
        aria-label={isConnecting ? "Connecting wallet" : "Connect wallet"}
        aria-busy={isConnecting}
        className={cn("w-full sm:w-auto", className)}
        disabled={isConnecting || props.disabled}
        onClick={() => setIsWalletModalOpen(true)}
      >
        {isConnecting && <Spinner />}
        Connect Wallet
      </Button>

      <WalletModal open={isWalletModalOpen} onOpenChange={setIsWalletModalOpen} />
    </>
  )
}

function AccountBadge({
  address,
  className,
  ...props
}: {
  address: string
  className?: string
} & ConnectButtonProps) {
  return (
    <Button
      {...props}
      type="button"
      variant="outline"
      aria-label={`Connected wallet ${formatAddress(address)}`}
      className={cn("w-full justify-start gap-2 sm:w-auto", className)}
    >
      <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
      <span className="font-mono">{formatAddress(address)}</span>
    </Button>
  )
}

function WalletModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect Wallet</DialogTitle>
          <DialogDescription>
            Choose a supported Stellar wallet to continue.
          </DialogDescription>
        </DialogHeader>

        <Button type="button" className="w-full justify-center">
          Freighter
        </Button>
      </DialogContent>
    </Dialog>
  )
}

function Spinner() {
  return (
    <svg
      className="size-3.5 animate-spin"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
      />
    </svg>
  )
}

function formatAddress(address: string) {
  if (address.length <= 12) {
    return address
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
