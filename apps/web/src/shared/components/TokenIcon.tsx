import { useState } from "react"
import { cn } from "@workspace/ui/lib/utils"

type Props = {
  symbol: string
  size?: number
  className?: string
}

const CDN_BASE = "https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@3.1.0/svg/color"

const SYMBOL_TO_CDN: Record<string, string> = {
  BTC: `${CDN_BASE}/btc.svg`,
  ETH: `${CDN_BASE}/eth.svg`,
  XLM: `${CDN_BASE}/xlm.svg`,
  USDC: `${CDN_BASE}/usdc.svg`,
  USDT: `${CDN_BASE}/usdt.svg`,
  SOL: `${CDN_BASE}/sol.svg`,
  BNB: `${CDN_BASE}/bnb.svg`,
}

const PLACEHOLDER_COLORS: Record<string, string> = {
  BTC: "bg-orange-500/15 text-orange-400 ring-orange-500/25",
  ETH: "bg-indigo-500/15 text-indigo-400 ring-indigo-500/25",
  XLM: "bg-sky-500/15 text-sky-400 ring-sky-500/25",
  USDC: "bg-blue-500/15 text-blue-400 ring-blue-500/25",
  GLV: "bg-teal-500/15 text-teal-400 ring-teal-500/25",
}

export function TokenIcon({ symbol, size = 32, className }: Props) {
  const [imgError, setImgError] = useState(false)
  const upper = symbol.toUpperCase()
  const cdnUrl = SYMBOL_TO_CDN[upper]
  const showImg = !!cdnUrl && !imgError
  const color = PLACEHOLDER_COLORS[upper] ?? "bg-muted/60 text-muted-foreground ring-border"

  return (
    <div
      role="img"
      aria-label={`${symbol} token icon`}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full ring-1 overflow-hidden",
        !showImg && color,
        className,
      )}
      style={{ width: size, height: size }}
    >
      {showImg ? (
        <img
          src={cdnUrl}
          alt={`${symbol} icon`}
          width={size}
          height={size}
          onError={() => setImgError(true)}
          className="h-full w-full object-contain p-0.5"
        />
      ) : (
        <span style={{ fontSize: Math.max(8, size * 0.3) }} className="font-semibold leading-none">
          {upper.slice(0, 2)}
        </span>
      )}
    </div>
  )
}
