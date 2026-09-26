import { Button } from "@workspace/ui/components/button"

export function DocsPlaceholderPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 md:px-6">
      <h1 className="text-2xl font-semibold text-text-primary">
        SO4 documentation
      </h1>
      <p className="mt-3 max-w-prose text-sm text-text-secondary">
        Learn how SO4 markets, contracts, and developer tooling work.
      </p>
      <Button className="mt-6">Browse documentation</Button>
    </section>
  )
}
