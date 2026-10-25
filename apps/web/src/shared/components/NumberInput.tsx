import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import type { ComponentPropsWithoutRef } from "react"
import { formatUsd } from "@/shared/lib/format"

type NumberInputProps = Omit<ComponentPropsWithoutRef<"input">, "onChange" | "type"> & {
  value: string
  onValueChange: (value: string) => void
  usdValue?: number | null
  onMax?: () => void
  maxButtonLabel?: string
}

const DECIMAL_INPUT_REGEX = /^$|^[0-9]*\.?[0-9]*$/

export function NumberInput({
  value,
  onValueChange,
  usdValue,
  onMax,
  maxButtonLabel = "MAX",
  placeholder,
  className,
  disabled,
  onKeyDown,
  onWheel,
  ...props
}: NumberInputProps) {
  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.value
    if (!DECIMAL_INPUT_REGEX.test(nextValue)) return
    onValueChange(nextValue)
  }

  return (
    <div className="space-y-1">
      <div className="relative">
        <Input
          type="text"
          inputMode="decimal"
          pattern="[0-9]*([.][0-9]*)?"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onKeyDown={(event) => {
            if (["e", "E", "+", "-"].includes(event.key)) event.preventDefault()
            onKeyDown?.(event)
          }}
          onWheel={(event) => {
            event.preventDefault()
            onWheel?.(event)
          }}
          className={cn(onMax && "pe-14", className)}
          disabled={disabled}
          {...props}
        />
        {onMax ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="absolute inset-inline-end-2 top-1/2 -translate-y-1/2 px-2 text-11"
            onClick={onMax}
            disabled={disabled}
          >
            {maxButtonLabel}
          </Button>
        ) : null}
      </div>
      {typeof usdValue === "number" && !Number.isNaN(usdValue) ? (
        <p className="text-right text-xs text-muted-foreground">{formatUsd(usdValue)}</p>
      ) : null}
    </div>
  )
}
