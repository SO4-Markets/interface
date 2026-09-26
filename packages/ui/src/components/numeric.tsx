import { cva } from 'class-variance-authority'
import { cn } from '@workspace/ui/lib/utils'
import { useNumericChangeFeedback } from '../hooks/use-numeric-change-feedback'
import type { VariantProps } from 'class-variance-authority'

const numericVariants = cva('font-mono tabular-nums', {
  variants: {
    role: {
      positive: 'text-green-500',
      negative: 'text-red-500',
      neutral: 'text-muted-foreground',
      warning: 'text-warning',
      danger: 'text-red-500 font-bold',
      'brand-long': 'text-green-500',
      'brand-short': 'text-red-500',
    },
  },
  defaultVariants: {
    role: 'neutral',
  },
})

type LegacyNumericRole = VariantProps<typeof numericVariants>['role']

interface NumericProps {
  value: number | null | undefined
  format?: 'usd' | 'token' | 'pct' | 'number' | 'small'
  role?: LegacyNumericRole
  decimals?: number
  compact?: boolean
  locale?: string
  currency?: string
  fallback?: string
  threshold?: number
  className?: string
}

const DEFAULT_LOCALE = "en-US"
const SMALL_THRESHOLD = 0.0001

function normalize(n: number): number {
  return Object.is(n, -0) ? 0 : n
}

function formatUsd(value: number, compact?: boolean, locale?: string, currency?: string): string {
  const loc = locale ?? DEFAULT_LOCALE
  const curr = currency ?? "USD"
  const dec = compact ? 0 : 2
  return new Intl.NumberFormat(loc, {
    style: "currency",
    currency: curr,
    minimumFractionDigits: dec,
    maximumFractionDigits: 2,
    ...(compact ? { notation: "compact" as const } : {}),
  }).format(normalize(value))
}

function formatToken(value: number, decimals?: number, locale?: string): string {
  const maxDecimals = decimals ?? 4
  return normalize(value).toLocaleString(locale ?? DEFAULT_LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  })
}

function formatPct(value: number): string {
  const v = normalize(value)
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(2)}%`
}

function formatNumber(value: number, locale?: string): string {
  return normalize(value).toLocaleString(locale ?? DEFAULT_LOCALE)
}

function formatSmall(value: number, decimals?: number, threshold?: number, locale?: string): string {
  const v = normalize(value)
  const dec = decimals ?? 4
  const thresh = threshold ?? SMALL_THRESHOLD
  if (v !== 0 && Math.abs(v) < thresh) {
    return `<${thresh.toLocaleString(locale ?? DEFAULT_LOCALE, {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    })}`
  }
  return v.toLocaleString(locale ?? DEFAULT_LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: dec,
  })
}

/**
 * Semantic tone for a numeric value already formatted by the caller.
 *
 * Unlike `Numeric` below, this primitive does not format or round its
 * children — it only supplies the tabular-figure font treatment and the
 * approved positive/negative/warning/accent/muted tones (DS-012).
 */
const numericTextVariants = cva("font-mono tabular-nums slashed-zero", {
  variants: {
    role: {
      neutral: "text-foreground",
      positive: "text-success",
      negative: "text-destructive",
      warning: "text-warning",
      accent: "text-primary",
      muted: "text-muted-foreground",
    },
    size: {
      "2xs": "text-10 leading-4",
      xs: "text-11 leading-4",
      sm: "text-xs leading-5",
      md: "text-13 leading-5",
      base: "text-sm leading-5",
      lg: "text-base leading-6",
    },
    weight: {
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
    },
  },
  defaultVariants: {
    role: "neutral",
    size: "base",
    weight: "normal",
  },
})

type NumericRole = VariantProps<typeof numericTextVariants>['role']

type NumericTextProps = React.ComponentProps<'span'> &
  VariantProps<typeof numericTextVariants>

function NumericText({ role, size, weight, className, ...props }: NumericTextProps) {
  return (
    <span
      data-slot="numeric-text"
      className={cn(numericTextVariants({ role, size, weight }), className)}
      {...props}
    />
  )
}

/** Derives a positive/negative/neutral role from a signed value's sign. */
function numericRoleForValue(
  value: number
): Extract<NumericRole, 'positive' | 'negative' | 'neutral'> {
  if (value > 0) return 'positive'
  if (value < 0) return 'negative'
  return 'neutral'
}

interface NumericProps {
  value: number | null | undefined
  format?: 'usd' | 'token' | 'pct' | 'number' | 'small'
  role?: LegacyNumericRole
  decimals?: number
  compact?: boolean
  locale?: string
  currency?: string
  fallback?: string
  threshold?: number
  highlightOnChange?: boolean
  coalesceMs?: number
  className?: string
}

function Numeric({
  value,
  format = 'number',
  role = 'neutral',
  decimals,
  compact = false,
  locale,
  currency,
  fallback = '\u2014',
  threshold,
  highlightOnChange = false,
  coalesceMs = 500,
  className,
}: NumericProps) {
  const { className: emphasisClassName } = useNumericChangeFeedback({
    value,
    coalesceMs,
    disabled: !highlightOnChange,
  })

  const display = (() => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return fallback
    }
    switch (format) {
      case 'usd':
        return formatUsd(value, compact, locale, currency)
      case 'token':
        return formatToken(value, decimals, locale)
      case 'pct':
        return formatPct(value)
      case 'small':
        return formatSmall(value, decimals, threshold, locale)
      case 'number':
        return formatNumber(value, locale)
    }
  })()

  return (
    <span
      data-slot="numeric"
      className={cn(numericVariants({ role }), highlightOnChange && emphasisClassName, className)}
    >
      {display}
    </span>
  )
}

export { Numeric, numericVariants, NumericText, numericTextVariants, numericRoleForValue }
export type { NumericRole, NumericProps, LegacyNumericRole, NumericTextProps }