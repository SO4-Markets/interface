import { useEffect, useId, useMemo, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Switch } from "@workspace/ui/components/switch"
import { toast } from "@workspace/ui/components/toast"
import {
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  buildPnlShareCard,
  drawPnlShareCard,
  resolveShareCardPalette,
  shareCardAltText,
  shareCardFileName,
  shareText,
  xIntentUrl,
} from "../../lib/pnl-share-card"
import type { ShareablePosition } from "../../lib/pnl-share-card"

type Props = {
  position: ShareablePosition | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob(resolve, "image/png")
    } catch {
      resolve(null)
    }
  })
}

/**
 * "Share PnL" (issue 955): previews the position card and offers the share paths a
 * browser supports — native share sheet with the image, copy image, download,
 * copy link, or post to X. The dollar amount is opt-in, so a screenshot does
 * not reveal position size unless the trader chooses to.
 */
export function SharePnlDialog({ position, open, onOpenChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [includeUsd, setIncludeUsd] = useState(false)
  const switchId = useId()

  const card = useMemo(
    () => (position ? buildPnlShareCard(position, { includeUsd }) : null),
    [position, includeUsd],
  )

  useEffect(() => {
    if (!open || !card) return
    // The canvas mounts with the dialog content; draw on the next frame.
    const frame = requestAnimationFrame(() => {
      const ctx = canvasRef.current?.getContext("2d")
      if (ctx) drawPnlShareCard(ctx, card, resolveShareCardPalette())
    })
    return () => cancelAnimationFrame(frame)
  }, [open, card])

  if (!position || !card) return null

  async function imageFile(): Promise<File | null> {
    const canvas = canvasRef.current
    if (!canvas || !position) return null
    const blob = await canvasToBlob(canvas)
    return blob ? new File([blob], shareCardFileName(position), { type: "image/png" }) : null
  }

  async function handleDownload() {
    const file = await imageFile()
    if (!file) {
      toast.error("Could not create the image")
      return
    }
    const href = URL.createObjectURL(file)
    const link = document.createElement("a")
    link.href = href
    link.download = file.name
    link.click()
    URL.revokeObjectURL(href)
  }

  async function handleCopyImage() {
    const file = await imageFile()
    if (!file || typeof ClipboardItem === "undefined" || !("write" in navigator.clipboard)) {
      toast.error("Copying images isn't supported in this browser", {
        description: "Use Download instead.",
      })
      return
    }
    try {
      await navigator.clipboard.write([new ClipboardItem({ [file.type]: file })])
      toast.success("PnL card copied")
    } catch {
      toast.error("Could not copy the image")
    }
  }

  async function handleCopyLink() {
    if (!card) return
    try {
      await navigator.clipboard.writeText(card.url)
      toast.success("Position link copied", { description: card.url })
    } catch {
      toast.error("Could not copy link to clipboard")
    }
  }

  async function handleNativeShare() {
    if (!card) return
    const file = await imageFile()
    const data: ShareData = { title: card.siteName, text: shareText(card), url: card.url }
    const withFile = file ? { ...data, files: [file] } : data
    try {
      // Older share implementations (e.g. Safari < 15) lack canShare and
      // reject file payloads, so fall back to text + link there.
      const supportsFile = "canShare" in navigator && navigator.canShare(withFile)
      await navigator.share(supportsFile ? withFile : data)
    } catch (error) {
      // Dismissing the share sheet rejects with AbortError — not a failure.
      if ((error as DOMException | undefined)?.name !== "AbortError") {
        toast.error("Could not open the share sheet")
      }
    }
  }

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function"
  const altText = shareCardAltText(card)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share PnL</DialogTitle>
          <DialogDescription>
            {card.side} {card.market} · {card.pnlPercent}
          </DialogDescription>
        </DialogHeader>

        <canvas
          ref={canvasRef}
          width={SHARE_CARD_WIDTH}
          height={SHARE_CARD_HEIGHT}
          role="img"
          aria-label={altText}
          data-testid="pnl-share-card"
          className="aspect-[1200/630] h-auto w-full rounded-md border border-border"
        />

        <div className="flex items-center justify-between gap-3">
          <label htmlFor={switchId} className="text-sm text-muted-foreground">
            Show USD amount
          </label>
          <Switch
            id={switchId}
            checked={includeUsd}
            onCheckedChange={(checked) => setIncludeUsd(checked)}
          />
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:justify-start">
          {canNativeShare && (
            <Button size="sm" onClick={() => void handleNativeShare()}>
              Share…
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => void handleCopyImage()}>
            Copy image
          </Button>
          <Button size="sm" variant="outline" onClick={() => void handleDownload()}>
            Download
          </Button>
          <Button size="sm" variant="outline" onClick={() => void handleCopyLink()}>
            Copy link
          </Button>
          <a
            href={xIntentUrl(card)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            Post on X
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
