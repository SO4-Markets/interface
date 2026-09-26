import { defineConfig } from "vite"
import mdx from "@mdx-js/rollup"
import remarkFrontmatter from "remark-frontmatter"
import remarkMdxFrontmatter from "remark-mdx-frontmatter"
import { rehypeMermaid } from "./src/lib/rehype-mermaid"
import { shikiPlugin } from "./src/lib/rehype-shiki"
import tailwindcss from "@tailwindcss/vite"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const budgets = JSON.parse(readFileSync(join(import.meta.dirname, "budgets.json"), "utf8")) as {
  initialJsKb: number
  initialCssKb: number
  measured: { initialJsKb: number; initialCssKb: number }
  headroom: { initialJsKb: number; initialCssKb: number }
}

function docsBudgetGuard() {
  return {
    name: "docs-budget-guard",
    enforce: "post" as const,
    generateBundle(_options: unknown, bundle: Record<string, unknown>) {
      const jsLimitKb = budgets.initialJsKb
      const cssLimitKb = budgets.initialCssKb
      for (const [fileName, chunk] of Object.entries(bundle)) {
        const c = chunk as { type: string; code?: string; source?: string | Uint8Array }
        if (c.type === "chunk" && typeof c.code === "string") {
          const sizeKb = c.code.length / 1024
          if (sizeKb > jsLimitKb) {
            throw new Error(
              `\n[docs-budget] Initial JS budget exceeded!\n` +
                `Chunk "${fileName}" is ${sizeKb.toFixed(2)} KB (budget is ${jsLimitKb} KB).\n` +
                `Measured current: ${budgets.measured.initialJsKb} KB, headroom ${budgets.headroom.initialJsKb} KB.\n` +
                `Adding a large client library will breach this. To update intentionally, edit apps/docs/budgets.json and document in BUDGET.md.\n`
            )
          }
        }
        if (c.type === "asset" && fileName.endsWith(".css") && typeof c.source === "string") {
          const css = c.source as string
          const sizeKb = css.length / 1024
          if (sizeKb > cssLimitKb) {
            throw new Error(
              `\n[docs-budget] CSS budget exceeded!\n` +
                `Asset "${fileName}" is ${sizeKb.toFixed(2)} KB (budget is ${cssLimitKb} KB).\n` +
                `Measured current: ${budgets.measured.initialCssKb} KB, headroom ${budgets.headroom.initialCssKb} KB.\n` +
                `To update intentionally, edit apps/docs/budgets.json and document in BUDGET.md.\n`
            )
          }
        }
      }
    },
  }
}

export default defineConfig({
  root: import.meta.dirname,
  plugins: [
    mdx({
      remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter],
      rehypePlugins: [rehypeMermaid, shikiPlugin],
    }),
    tailwindcss(),
    docsBudgetGuard(),
  ],
  build: {
    outDir: ".nitro-static",
    emptyOutDir: false,
  },
})
