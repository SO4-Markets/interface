import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group"
import { VisuallyHidden } from "@workspace/ui/components/visually-hidden"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  
  
  groupingOptions
} from "../../lib/orderbook/display-prefs"
import {  isBookLayout } from "../../lib/orderbook/layout"
import type {MarketDisplayMetadata, SizeUnit} from "../../lib/orderbook/display-prefs";
import type {BookLayout} from "../../lib/orderbook/layout";

type Props = {
  /** Null or unusable metadata disables the controls that depend on it. */
  metadata: MarketDisplayMetadata | null
  groupingMultiplier: number
  unit: SizeUnit
  layout: BookLayout
  onGroupingChange: (multiplier: number) => void
  onUnitChange: (unit: SizeUnit) => void
  onLayoutChange: (layout: BookLayout) => void
}

const LAYOUT_LABELS: ReadonlyArray<{ value: BookLayout; text: string; name: string }> = [
  { value: "both", text: "Both", name: "Show bids and asks" },
  { value: "bids", text: "Bids", name: "Show bids only" },
  { value: "asks", text: "Asks", name: "Show asks only" },
]

/**
 * OB-052 / OB-053: grouping, size unit and layout controls for the depth view.
 *
 * All three are real form controls with explicit accessible names, so they work
 * with a keyboard (arrow keys move within a radio group; the select opens with
 * Enter/Space/arrow keys) and announce the unit rather than just a number.
 */
export function DepthControls({
  metadata,
  groupingMultiplier,
  unit,
  layout,
  onGroupingChange,
  onUnitChange,
  onLayoutChange,
}: Props) {
  const options = groupingOptions(metadata)
  const canGroup = options.length > 0 && metadata !== null

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1" role="group" aria-label="Order book display">
      <Select
        value={String(groupingMultiplier)}
        onValueChange={(value) => {
          const multiplier = Number(value)
          if (Number.isInteger(multiplier)) onGroupingChange(multiplier)
        }}
        disabled={!canGroup}
      >
        <SelectTrigger aria-label="Price grouping" className="h-7 min-w-20 text-xs">
          <SelectValue>
            {(value: string) => options.find((o) => String(o.multiplier) === value)?.label ?? "—"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.multiplier} value={String(option.multiplier)}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <RadioGroup
        aria-label="Size unit"
        className="flex flex-row items-center gap-2"
        value={unit}
        disabled={metadata === null}
        onValueChange={(value) => {
          if (value === "base" || value === "quote") onUnitChange(value)
        }}
      >
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <RadioGroupItem value="base" />
          <span aria-hidden="true">{metadata?.baseSymbol ?? "Base"}</span>
          <VisuallyHidden>{`Size in ${metadata?.baseSymbol ?? "base asset"}`}</VisuallyHidden>
        </label>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <RadioGroupItem value="quote" />
          <span aria-hidden="true">{metadata?.quoteSymbol ?? "Quote"}</span>
          <VisuallyHidden>{`Size in ${metadata?.quoteSymbol ?? "quote asset"}`}</VisuallyHidden>
        </label>
      </RadioGroup>

      <RadioGroup
        aria-label="Order book layout"
        className="flex flex-row items-center gap-2"
        value={layout}
        onValueChange={(value) => {
          if (isBookLayout(value)) onLayoutChange(value)
        }}
      >
        {LAYOUT_LABELS.map(({ value, text, name }) => (
          <label key={value} className="flex items-center gap-1 text-xs text-muted-foreground">
            <RadioGroupItem value={value} />
            <span aria-hidden="true">{text}</span>
            <VisuallyHidden>{name}</VisuallyHidden>
          </label>
        ))}
      </RadioGroup>
    </div>
  )
}
