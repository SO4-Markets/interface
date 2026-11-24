import { useState } from "react"
import { Button } from "@workspace/ui/components/button"

const key = "so4-order-size-presets-v1"
const defaults = [25, 50, 75]

function valid(values: Array<number>) {
  return values.length === 3 && new Set(values).size === 3 &&
    values.every((n) => Number.isInteger(n) && n > 0 && n < 100)
}

function readPresets(): Array<number> {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? "null")
    if (Array.isArray(saved) && valid(saved)) return saved
  } catch { /* Storage is optional. */ }
  return defaults
}

export function SizePresets({ onFill }: { onFill: (percent: number) => void }) {
  const [values, setValues] = useState(readPresets)
  const [draft, setDraft] = useState<Array<string> | null>(null)
  return (
    <div role="group" aria-label="Order size presets" className="flex flex-wrap gap-1 pt-1">
      {[...values, 100].map((value) => (
        <Button type="button" key={value} variant="outline" size="xs" onClick={() => onFill(value)}>
          {value === 100 ? "Max" : value + "%"}
        </Button>
      ))}
      <Button type="button" variant="ghost" size="xs" aria-expanded={draft !== null}
        onClick={() => setDraft(draft ? null : values.map(String))}>Edit presets</Button>
      {draft && <fieldset className="w-full space-y-2">
        <legend>Order size percentages</legend>
        {draft.map((value, index) => <label key={index} className="block">
          Preset {index + 1} (%)
          <input type="number" min={1} max={99} step={1} value={value}
            onChange={(event) => setDraft(draft.map((old, i) => i === index ? event.target.value : old))} />
        </label>)}
        {!valid(draft.map(Number)) && <p role="status">Use three different whole percentages between 1 and 99.</p>}
        <Button type="button" disabled={!valid(draft.map(Number))} onClick={() => {
          const next = draft.map(Number)
          setValues(next)
          try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* Keep session values. */ }
          setDraft(null)
        }}>Save presets</Button>
      </fieldset>}
    </div>
  )
}
