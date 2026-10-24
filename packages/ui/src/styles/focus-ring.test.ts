import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const stylesheet = readFileSync(
  resolve(process.cwd(), "src/styles/globals.css"),
  "utf8"
)

describe("shared focus-ring motion contract", () => {
  it("uses the existing fast motion tokens and compositor-friendly properties", () => {
    expect(stylesheet).toMatch(
      /:where\(button, a, \[role="button"\]\):after\s*\{[\s\S]*transition:[\s\S]*opacity var\(--duration-fast\) var\(--ease-out\),[\s\S]*transform var\(--duration-fast\) var\(--ease-out\)/
    )
    expect(stylesheet).not.toMatch(/so4-focus-ring-in|transition:\s*all\b/)
  })

  it("turns focus-ring motion off for reduced-motion users", () => {
    expect(stylesheet).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*:where\(button, a, \[role="button"\]\):after\s*\{[\s\S]*transition: none;/
    )
  })

  it("keeps a system-colored focus indicator in forced-colors mode", () => {
    expect(stylesheet).toMatch(
      /@media \(forced-colors: active\)[\s\S]*\*:\s*focus-visible\s*\{[\s\S]*outline: 2px solid Highlight !important;/
    )
    expect(stylesheet).toMatch(
      /:where\(button, a, \[role="button"\]\):focus-visible:after\s*\{[\s\S]*border-color: Highlight;/
    )
  })
})
