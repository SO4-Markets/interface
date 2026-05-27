import { cn } from "@workspace/ui/lib/utils"
import type { TimePeriod } from "../../hooks/use-referrals-data"

const PERIODS: Array<{ value: TimePeriod; label: string }> = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "total", label: "Total" },
]

type Props = {
  value: TimePeriod
  onChange: (p: TimePeriod) => void
}

export function TimePeriodFilter({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/30 p-0.5">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
            value === p.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
