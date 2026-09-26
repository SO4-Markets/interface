import { resolve } from "node:path"

import { headingEntries, loadPages } from "./content"

const faq = (await loadPages()).find((page) => page.route === "/resources/faq")
if (!faq) throw new Error("FAQ source is missing")
const landing = new Set(faq.frontmatter.landing ?? [])
// `headingEntries` returns `{ title, id }` pairs, so each entry's answer text
// is taken from its own section of the FAQ body.
const sectionBodies = new Map(
  faq.body
    .split(/\n(?=## )/)
    .filter((text) => text.startsWith("## "))
    .map((text) => [
      text.match(/\{#([a-z0-9-]+)\}/)?.[1],
      text.slice(text.indexOf("\n") + 1).trim(),
    ]),
)
const entries = headingEntries(faq.body)
  .filter((entry) => landing.has(entry.id))
  .map((entry) => {
    const answer = sectionBodies.get(entry.id) ?? ""
    const link = answer.match(/\[([^\]]+)\]\(([^)]+)\)\.$/)
    if (!link)
      throw new Error(`FAQ ${entry.id} must end with one documentation link`)
    return {
      id: entry.id,
      question: entry.title,
      answer: answer.slice(0, link.index).trim(),
      linkLabel: link[1],
      href: link[2],
    }
  })

if (entries.length !== landing.size)
  throw new Error("landing frontmatter names an unknown FAQ entry")

const output = `// Generated from apps/docs/content/resources/faq.mdx. Do not edit.\nexport const LANDING_FAQS = ${JSON.stringify(entries, null, 2)} as const\n`
const target = resolve(
  import.meta.dir,
  "../../web/src/ui/landing/faq.generated.ts",
)

if (process.argv.includes("--check")) {
  const current = await Bun.file(target)
    .text()
    .catch(() => "")
  if (current !== output) {
    console.error(
      "Landing FAQ data is stale. Run: bun run --cwd apps/docs generate:faq",
    )
    process.exit(1)
  }
  console.log("Landing FAQ data matches its MDX source.")
} else {
  await Bun.write(target, output)
  console.log(`Generated ${entries.length} landing FAQ entries.`)
}
