import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const stylesheet = readFileSync(
  resolve(process.cwd(), "src/styles/globals.css"),
  "utf8"
)

const buttonSource = readFileSync(
  resolve(process.cwd(), "src/components/button.tsx"),
  "utf8"
)
const inputSource = readFileSync(
  resolve(process.cwd(), "src/components/input.tsx"),
  "utf8"
)
const tabsSource = readFileSync(
  resolve(process.cwd(), "src/components/tabs.tsx"),
  "utf8"
)

describe("shared focus-ring motion contract", () => {
  it("keeps the relative-position affordance in the base layer so fixed utilities win", () => {
    expect(stylesheet).toMatch(
      /@layer base\s*\{[\s\S]*?:where\(button, a, \[role="button"\]\)\s*\{[\s\S]*?position: relative;/
    )
  })

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

describe("shared control focus-visible indicators", () => {
  it("button primitive shows a visible ring and outline on focus-visible using tokens", () => {
    expect(buttonSource).toMatch(/focus-visible:ring-2 focus-visible:ring-ring\/30/)
    expect(buttonSource).toMatch(/focus-visible:outline-2 focus-visible:outline-ring/)
    expect(buttonSource).toMatch(/focus-visible:outline-offset-2/)
  })

  it("input primitive shows a visible outline on focus-visible, not only a ring", () => {
    expect(inputSource).toMatch(/focus-visible:outline-2 focus-visible:outline-ring/)
    expect(inputSource).toMatch(/focus-visible:ring-\[3px\] focus-visible:ring-ring\/50/)
  })

  it("tabs trigger and content keep a visible outline on focus-visible", () => {
    expect(tabsSource).toMatch(/focus-visible:outline-2 focus-visible:outline-ring/)
    expect(tabsSource).toMatch(/focus-visible:ring-\[3px\] focus-visible:ring-ring\/50/)
  })
})
