import type { TimePeriod } from "../../hooks/use-referrals-data"
import { formatUsd } from "@/shared/lib/format"



function xAxisLabels(period: TimePeriod): Array<string> {
  const now = new Date()
  const fmt = (d: Date) =>
    `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
  const msAgo = (ms: number) => new Date(now.getTime() - ms)
  const day = 86_400_000

  const ranges: Record<TimePeriod, number> = {
    "24h": day,
    "7d": 7 * day,
    "30d": 30 * day,
    "90d": 90 * day,
    total: 365 * day,
  }

  const total = ranges[period]
  return Array.from({ length: 5 }, (_, i) => fmt(msAgo(total - (i / 4) * total)))
}

type InfoIconProps = { className?: string }

function InfoIcon({ className }: InfoIconProps) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
    </svg>
  )
}

type Props = {
  title: string
  tooltip: string
  value: number
  period: TimePeriod
  accent?: "green" | "blue"
}

export function StatChartCard({ title, tooltip, value, period, accent = "blue" }: Props) {
  const labels = xAxisLabels(period)
  const accentColor = accent === "green" ? "#4ade80" : "#60a5fa"

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">{title}</span>
          <span title={tooltip} className="cursor-help text-muted-foreground/50 hover:text-muted-foreground">
            <InfoIcon />
          </span>
        </div>
        <p className="mt-1.5 text-[22px] font-semibold tabular-nums tracking-tight">
          {formatUsd(value)}
        </p>
      </div>

      {/* Chart area */}
      <div className="relative px-3 pb-3">
        <svg
          viewBox="0 0 400 110"
          className="w-full"
          aria-hidden
        >
          {/* Horizontal grid lines + y-axis labels */}
          {[4, 3, 2, 1, 0].map((tick, i) => {
            const y = 8 + (i / 4) * 72
            return (
              <g key={tick}>
                <line
                  x1={28}
                  y1={y}
                  x2={396}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={0.06}
                  strokeWidth={0.75}
                />
                <text
                  x={22}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize={8}
                  fill="currentColor"
                  fillOpacity={0.25}
                >
                  {tick}
                </text>
              </g>
            )
          })}

          {/* Zero line (data sits here when value = 0) */}
          <line
            x1={28}
            y1={80}
            x2={396}
            y2={80}
            stroke={accentColor}
            strokeOpacity={0.4}
            strokeWidth={1.5}
            strokeLinecap="round"
          />

          {/* X-axis date labels */}
          {labels.map((label, i) => {
            const x = 28 + (i / (labels.length - 1)) * 368
            return (
              <text
                key={label}
                x={x}
                y={100}
                textAnchor="middle"
                fontSize={7.5}
                fill="currentColor"
                fillOpacity={0.25}
              >
                {label}
              </text>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
