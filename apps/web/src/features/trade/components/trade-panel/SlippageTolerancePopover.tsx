"use client"

import { useState } from "react"

import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "@workspace/ui/components/popover"
import { Button } from "@workspace/ui/components/button"
import { Kbd } from "@workspace/ui/components/kbd"
import { NumberInput } from "@/shared/components/NumberInput"

const PRESETS: ReadonlyArray<number> = [0.1, 0.5, 1]

type SlippageTolerancePopoverProps = {
  slippagePct: number
  onSlippageChange: (value: number) => void
}

export function SlippageTolerancePopover({ slippagePct, onSlippageChange }: SlippageTolerancePopoverProps) {
  const [open, setOpen] = useState(false)
  const [customValue, setCustomValue] = useState(String(slippagePct))

  function handlePreset(value: number) {
    onSlippageChange(value)
    setCustomValue(String(value))
    setOpen(false)
  }

  function handleCustomChange(value: string) {
    setCustomValue(value)
  }

  function handleCustomBlur() {
    if (!customValue || customValue === ".") {
      setCustomValue(String(slippagePct))
      return
    }
    const parsed = Number(customValue)
    if (!Number.isFinite(parsed)) {
      setCustomValue(String(slippagePct))
      return
    }
    const clamped = Math.min(10, Math.max(0, parsed))
    setCustomValue(String(clamped))
    onSlippageChange(clamped)
  }

  function handleCustomSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const value = Number(customValue)
    if (Number.isFinite(value) && value >= 0 && value <= 10) {
      onSlippageChange(value)
      setCustomValue(String(value))
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="w-auto min-w-[86px] text-xs"
        >
          Slippage <span className="font-medium">{slippagePct}%</span>
          <Kbd className="ml-1 size-2.5">▾</Kbd>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[252px] p-3">
        <PopoverTitle>Slippage tolerance</PopoverTitle>
        <PopoverDescription>
          Maximum allowable price movement before the order reverts.
        </PopoverDescription>
        <form onSubmit={handleCustomSubmit} className="mt-3 space-y-3">
          <div className="grid grid-cols-3 gap-1">
            {PRESETS.map((value) => (
              <Button
                key={value}
                type="button"
                variant={slippagePct === value ? "default" : "outline"}
                size="sm"
                onClick={() => handlePreset(value)}
                className="text-xs"
              >
                {value}%
              </Button>
            ))}
          </div>
          <div className="space-y-1">
            <label htmlFor="trade-slippage" className="text-xs text-muted-foreground block">Custom</label>
            <NumberInput
              id="trade-slippage"
              aria-label="Slippage tolerance percentage"
              value={customValue}
              onValueChange={handleCustomChange}
              onBlur={handleCustomBlur}
              placeholder="0.3"
              className="text-xs font-mono"
            />
          </div>
          {slippagePct > 1 && (
            <p className="mt-1 text-xs text-red-500">
              High slippage may result in worse fill prices.
            </p>
          )}
          <button type="submit" className="sr-only" aria-hidden="true" />
        </form>
      </PopoverContent>
    </Popover>
  )
}
