"use client"

import * as React from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import { useClipboard } from "@workspace/ui/hooks/use-clipboard"
import type { ClipboardStatus } from "@workspace/ui/hooks/use-clipboard"
import type { VariantProps } from "class-variance-authority"
import type { buttonVariants } from "@workspace/ui/components/button"

type CopyButtonTone = Exclude<
  NonNullable<VariantProps<typeof buttonVariants>["variant"]>,
  "link"
>

interface CopyButtonProps extends Omit<
  React.ComponentProps<typeof Button>,
  "onClick" | "children"
> {
  /** The value written to the clipboard on click. */
  value: string
  /** Accessible label (required for icon-only mode). */
  label: string
  /**
   * Visible text alongside the icon. When omitted the button renders as
   * icon-only and uses `label` as the accessible name + tooltip.
   */
  children?: React.ReactNode
  /** Button tone. @default "ghost" */
  tone?: CopyButtonTone
  /** Milliseconds before the status resets. @default 2000 */
  resetAfter?: number
  /** Called after the clipboard write succeeds. */
  onCopied?: () => void
}

const STATUS_ICON: Record<ClipboardStatus, React.ReactNode> = {
  idle: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x={9} y={9} width={13} height={13} rx={2} />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  copied: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-success"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  failed: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-destructive"
    >
      <circle cx={12} cy={12} r={10} />
      <line x1={15} y1={9} x2={9} y2={15} />
      <line x1={9} y1={9} x2={15} y2={15} />
    </svg>
  ),
}

const STATUS_TOOLTIP: Record<ClipboardStatus, string> = {
  idle: "",
  copied: "Copied!",
  failed: "Failed to copy",
}

function CopyButton({
  value,
  label,
  children,
  tone = "ghost",
  resetAfter = 2000,
  onCopied,
  className,
  disabled,
  ...props
}: CopyButtonProps) {
  const { status, copy } = useClipboard({ resetAfter })
  const isIconOnly = !children
  const feedbackId = React.useId()

  const tooltipContent =
    status !== "idle" ? STATUS_TOOLTIP[status] : isIconOnly ? label : undefined

  const button = (
    <Button
      type="button"
      variant={tone}
      size={isIconOnly ? "icon" : "default"}
      aria-label={isIconOnly ? label : undefined}
      data-slot="copy-button"
      disabled={disabled}
      className={cn(isIconOnly && "touch-target", className)}
      aria-describedby={status !== "idle" ? feedbackId : undefined}
      onClick={() => {
        void copy(value).then((didCopy) => {
          if (didCopy) onCopied?.()
        })
      }}
      {...props}
    >
      <span
        aria-hidden="true"
        className="so4-copy-icon relative inline-flex size-3.5"
        data-copy-status={status}
      >
        {(Object.keys(STATUS_ICON) as Array<ClipboardStatus>).map(
          (iconStatus) => (
            <span
              key={iconStatus}
              data-copy-icon={iconStatus}
              className={cn(
                "duration-fast absolute inset-0 inline-flex transition-[opacity,transform] ease-out motion-reduce:transition-none",
                iconStatus === status
                  ? "scale-100 opacity-100"
                  : "scale-75 opacity-0"
              )}
            >
              {STATUS_ICON[iconStatus]}
            </span>
          )
        )}
      </span>
      {children}
    </Button>
  )

  if (status !== "idle") {
    return (
      <span className="relative inline-flex">
        {button}
        <span
          id={feedbackId}
          className="so4-copy-feedback absolute start-1/2 bottom-full mb-1 -translate-x-1/2 rounded-md border border-border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-md"
          role="tooltip"
        >
          {STATUS_TOOLTIP[status]}
        </span>
        <span className="sr-only" role="status" aria-live="polite">
          {STATUS_TOOLTIP[status]}
        </span>
      </span>
    )
  }

  if (!tooltipContent) return button

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent>{tooltipContent}</TooltipContent>
    </Tooltip>
  )
}

export { CopyButton }
export type { CopyButtonProps }
