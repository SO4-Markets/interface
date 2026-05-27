import { useState } from "react"
import { cn } from "@workspace/ui/lib/utils"

export type FaqItem = {
  q: string
  a: string
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className={cn("shrink-0 transition-transform duration-200", open && "rotate-180")}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function AccordionItem({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-border/60 last:border-b-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 py-3 text-left"
      >
        <span className="text-[12px] font-medium leading-snug">{item.q}</span>
        <ChevronIcon open={open} />
      </button>

      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          open ? "max-h-96 pb-3" : "max-h-0",
        )}
      >
        <p className="text-[11px] leading-relaxed text-muted-foreground">{item.a}</p>
      </div>
    </div>
  )
}

type Props = {
  items: Array<FaqItem>
  title?: string
}

export function FaqAccordion({ items, title = "FAQ" }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div>
        {items.map((item) => (
          <AccordionItem key={item.q} item={item} />
        ))}
      </div>
    </div>
  )
}
