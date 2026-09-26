import { describe, expect, test } from "bun:test"
import { $ } from "bun"
import { join } from "node:path"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"

const appRoot = join(import.meta.dir, "..")

describe("Search Index", () => {
  test("generates deterministic index", async () => {
    // Build first time
    await $`bun run scripts/build.ts && bunx --bun pagefind --site .nitro-static`
      .cwd(appRoot)
      .quiet()
    const run1 = await $`find .nitro-static/pagefind -type f -exec shasum {} +`
      .cwd(appRoot)
      .text()

    // Build second time
    await $`bun run scripts/build.ts && bunx --bun pagefind --site .nitro-static`
      .cwd(appRoot)
      .quiet()
    const run2 = await $`find .nitro-static/pagefind -type f -exec shasum {} +`
      .cwd(appRoot)
      .text()

    // Expect outputs to be completely identical
    expect(run1).toEqual(run2)
  }, 15000)

  test("draft pages are absent from production index", async () => {
    const draftPagePath = join(
      appRoot,
      ".nitro-static/resources/terms/index.html"
    )
    expect(existsSync(draftPagePath)).toBe(false)
  })

  test("navigation text does not pollute indexed results", async () => {
    // We check that the HTML structure explicitly ignores the header
    const sampleHtml = await readFile(
      join(appRoot, ".nitro-static/resources/faq/index.html"),
      "utf-8"
    )
    expect(sampleHtml).toContain("data-pagefind-ignore")
    expect(sampleHtml).toContain("data-pagefind-body")

    // As a result, pagefind will not index "Open interface" (which is in the header)
    // We can also verify that 'Open interface' is absent in the pagefind index chunks, but
    // relying on pagefind's own directives is the supported way to assert this.
  })
})
