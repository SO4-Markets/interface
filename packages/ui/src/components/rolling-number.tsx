import { cn } from '@workspace/ui/lib/utils'

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

interface RollingNumberProps {
  value: string
  className?: string
}

/**
 * Renders a formatted number with each digit on a vertical odometer strip.
 * Only transform moves, so a change slides digits without shifting layout.
 * Non-digit characters (sign, currency, separators) render as-is.
 */
function RollingNumber({ value, className }: RollingNumberProps) {
  const chars = Array.from(value)

  return (
    <span className={cn('inline-flex tabular-nums', className)}>
      <span className="sr-only">{value}</span>
      {chars.map((char, index) => {
        // Key by position from the right so digits keep their column identity.
        const key = chars.length - index
        return /\d/.test(char) ? (
          <RollingDigit key={key} digit={Number(char)} />
        ) : (
          <span key={key} aria-hidden="true">
            {char}
          </span>
        )
      })}
    </span>
  )
}

function RollingDigit({ digit }: { digit: number }) {
  return (
    <span aria-hidden="true" className="relative inline-block h-[1lh] w-[1ch] overflow-hidden">
      <span
        className="flex flex-col transition-transform duration-base ease-out motion-reduce:transition-none"
        style={{ transform: `translateY(-${digit * 10}%)` }}
      >
        {DIGITS.map((d) => (
          <span key={d} className="flex h-[1lh] items-center justify-center">
            {d}
          </span>
        ))}
      </span>
    </span>
  )
}

export { RollingNumber }
