/**
 * DS-048: Design-token usage check.
 *
 * Scans production TSX/CSS for design values that bypass the token system
 * defined in packages/ui/src/styles/globals.css (Tailwind v4 `@theme`
 * tokens): raw hex colors, arbitrary Tailwind font-size classes
 * (`text-[...]`), and arbitrary Tailwind radius classes (`rounded-[...]`).
 *
 * Documented exceptions (SVG art, generated files, etc.) are listed in
 * ALLOWLIST below with a short reason, so the check stays actionable rather
 * than noisy. Anything not on the allowlist that trips a rule fails the
 * check (non-zero exit), reporting file:line and the offending value.
 *
 * Usage:
 *   bun run scripts/check-design-tokens.ts
 *   bun run check:tokens   (root package.json script)
 */

import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, "..")

const SCAN_DIRS = ["apps/web/src", "apps/docs/src", "packages/ui/src"]
const SCAN_EXTENSIONS = [".tsx", ".ts", ".css"]

// Directories to skip entirely regardless of extension.
const IGNORE_DIR_SEGMENTS = [
  "node_modules",
  "dist",
  "generated",
  ".turbo",
  "__fixtures__",
]

/**
 * Explicit, reviewed exceptions. Each entry is a relative path (from repo
 * root) or a path prefix, paired with why arbitrary values are acceptable
 * there. Keep this list small and specific — it is meant to be read, not
 * grown by reflex whenever the check is inconvenient.
 */
const ALLOWLIST: Record<string, string> = {
  "packages/ui/src/styles/globals.css":
    "Defines the token system itself (oklch color scale, radius scale) — this is the source of truth the check validates everything else against, not a consumer of it.",
  "apps/web/src/styles/landing.css":
    "Uses #000 as a mask-image radial-gradient stop (an opacity/luminance value, not a visible color) — plain CSS gradient functions can't take a Tailwind color token here.",
  "apps/web/src/features/trade/components/chart/TVChartContainer.tsx":
    "Configures the lightweight-charts library's imperative JS API (chart series colors, price-line colors), which requires literal color strings — there is no Tailwind-class equivalent for a third-party canvas-rendering library's config object.",
  "apps/docs/src/lib/mermaid.ts":
    "Serialises two pre-rendered SVG theme variants (lightSvg/darkSvg) at build time, which needs literal fill/stroke values in the markup: the DS role tokens these mirror (--surface-*, --text-*, --border, --primary) are only declared under `.dark` in globals.css, so a var() reference would leave the light diagram uncoloured. Same constraint as chart-theme.ts below — the palettes are confined to the two `colors` objects in buildFlowchartSvg/buildSequenceSvg.",
  "apps/web/src/features/trade/lib/chart-theme.ts":
    "sRGB fallback mirrors of the globals.css tokens, plus a canvas-based color parser sentinel. lightweight-charts parses colors itself and only understands hex/rgb/hsl/named values, so these cannot be oklch() token references; they are needed for SSR, unit tests, and first paint before the stylesheet applies.",
}

interface Violation {
  file: string
  line: number
  column: number
  rule: string
  value: string
  context: string
}

// Matches a real hex color (3, 4, 6, or 8 hex digits after #), not e.g. a
// URL fragment or a non-color word starting with '#'.
const HEX_COLOR_RE = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g

// Matches Tailwind arbitrary-value font-size utilities: text-[...], with an
// optional leading responsive/state variant (sm:text-[...], dark:text-[...]).
const ARBITRARY_TEXT_SIZE_RE = /(?:^|[\s"'`])(?:[a-z-]+:)*text-\[[^\]]+\]/g

// Matches Tailwind arbitrary-value radius utilities: rounded-[...], rounded-t-[...], etc.
const ARBITRARY_RADIUS_RE =
  /(?:^|[\s"'`])(?:[a-z-]+:)*rounded(?:-[trblse]{1,2})?-\[[^\]]+\]/g

function isAllowlisted(relPath: string): string | undefined {
  for (const [prefix, reason] of Object.entries(ALLOWLIST)) {
    if (relPath === prefix || relPath.startsWith(prefix + "/")) return reason
  }
  return undefined
}

function shouldSkipDir(name: string): boolean {
  return IGNORE_DIR_SEGMENTS.includes(name)
}

// Test files aren't "production TSX/CSS" (issue #435's own scope) — and in
// practice they're full of false-positive matches: `describe("... (#328)")`
// referencing an issue number looks exactly like a 3-digit hex color to a
// naive regex, since `328` only contains valid hex digits.
const TEST_FILE_RE = /\.(test|spec)\.[tj]sx?$/

function isTestFile(name: string): boolean {
  return TEST_FILE_RE.test(name)
}

function walk(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name)) continue
      walk(path.join(dir, entry.name), out)
    } else if (
      SCAN_EXTENSIONS.includes(path.extname(entry.name)) &&
      !isTestFile(entry.name)
    ) {
      out.push(path.join(dir, entry.name))
    }
  }
}

function checkFile(absPath: string): Violation[] {
  const relPath = path.relative(ROOT, absPath).split(path.sep).join("/")
  if (isAllowlisted(relPath)) return []

  const content = fs.readFileSync(absPath, "utf8")
  const lines = content.split("\n")
  const violations: Violation[] = []

  lines.forEach((lineText, idx) => {
    for (const [rule, re] of [
      ["raw-hex-color", HEX_COLOR_RE],
      ["arbitrary-text-size", ARBITRARY_TEXT_SIZE_RE],
      ["arbitrary-radius", ARBITRARY_RADIUS_RE],
    ] as const) {
      re.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = re.exec(lineText))) {
        // Line-level allowlist escape hatch, e.g.:
        //   className="text-[13.5px]" // ds-allow: hand-tuned nav baseline
        // Also accepted anywhere in the few lines immediately above, since a
        // `{/* ds-allow: ... */}` JSX comment explaining a long className
        // often wraps onto its own line(s) rather than being squeezed onto
        // the same line as the code it's explaining.
        const NEARBY_LOOKBACK = 5
        const nearbyLines = lines.slice(
          Math.max(0, idx - NEARBY_LOOKBACK),
          idx + 1
        )
        if (nearbyLines.some((l) => l.includes("ds-allow:"))) continue

        // CSS keyword values (`rounded-[inherit]`, `text-[inherit]`, etc.)
        // explicitly defer to a parent/existing value rather than
        // introducing a new magic number — not what this check targets.
        if (/\[(?:inherit|unset|initial|revert)\]$/.test(match[0])) continue

        // `(#123)` is this codebase's convention for citing an issue number
        // in a comment (e.g. "// fixes the overflow bug (#133)"), not a hex
        // color — a bare 3-digit hex code is otherwise indistinguishable
        // from an issue number, so exclude this specific citation shape.
        if (
          rule === "raw-hex-color" &&
          lineText[match.index - 1] === "(" &&
          lineText[match.index + match[0].length] === ")"
        ) {
          continue
        }

        violations.push({
          file: relPath,
          line: idx + 1,
          column: match.index + 1,
          rule,
          value: match[0].trim(),
          context: lineText.trim(),
        })
      }
    }
  })

  return violations
}

function main(): void {
  const files: string[] = []
  for (const dir of SCAN_DIRS) {
    const abs = path.join(ROOT, dir)
    if (fs.existsSync(abs)) walk(abs, files)
  }

  const allViolations = files.flatMap(checkFile)

  if (allViolations.length === 0) {
    console.log(
      `✓ Design token check passed — scanned ${files.length} files, 0 violations.`
    )
    return
  }

  console.error(
    `✗ Design token check failed — ${allViolations.length} violation(s):\n`
  )
  for (const v of allViolations) {
    console.error(`  ${v.file}:${v.line}:${v.column}  [${v.rule}]  ${v.value}`)
    console.error(`    ${v.context}`)
  }
  console.error(
    `\nFix by using an existing token (see packages/ui/src/styles/globals.css), or if the` +
      `\nvalue is genuinely intentional, either add a "// ds-allow: <reason>" comment on the` +
      `\nsame line, or add the file to ALLOWLIST in scripts/check-design-tokens.ts with a reason.`
  )
  process.exit(1)
}

main()
