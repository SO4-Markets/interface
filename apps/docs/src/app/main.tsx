import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { DocsLayout } from "../components/DocsLayout"
import { DocsPlaceholderPage } from "./page"
import "../styles/globals.css"

const root = document.getElementById("root")

if (!root) throw new Error("Missing docs application root")

createRoot(root).render(
  <StrictMode>
    <DocsLayout
      header={
        <a href="/" className="text-sm font-semibold text-text-primary">
          SO4 docs
        </a>
      }
      sidebar={
        <nav aria-label="Documentation" className="space-y-2 text-sm">
          <a
            href="/developers/architecture"
            className="block text-text-secondary hover:text-text-primary"
          >
            Developers
          </a>
          <a
            href="/concepts/risk"
            className="block text-text-secondary hover:text-text-primary"
          >
            Concepts
          </a>
          <a
            href="/reference/data-store"
            className="block text-text-secondary hover:text-text-primary"
          >
            Reference
          </a>
          <a
            href="/resources/faq"
            className="block text-text-secondary hover:text-text-primary"
          >
            Resources
          </a>
        </nav>
      }
      footer={<p className="text-sm text-text-secondary">SO4 documentation</p>}
    >
      <DocsPlaceholderPage />
    </DocsLayout>
  </StrictMode>
)
