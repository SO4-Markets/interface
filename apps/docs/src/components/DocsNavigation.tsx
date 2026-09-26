import { cn } from "@workspace/ui/lib/utils"

import type { NavSection } from "../lib/navigation"

interface DocsNavigationProps {
  sections: NavSection[]
  currentRoute?: string
  onNavigate?: () => void
  className?: string
}

export function DocsNavigation({
  sections,
  currentRoute,
  onNavigate,
  className,
}: DocsNavigationProps) {
  return (
    <nav aria-label="Documentation" className={cn("space-y-6", className)}>
      {sections.map((section) => (
        <section key={section.label} aria-labelledby={`nav-${section.label}`}>
          <h2
            id={`nav-${section.label}`}
            className="mb-2 text-xs font-semibold text-text-primary"
          >
            {section.label}
          </h2>
          <ul className="space-y-1">
            {section.pages.map((page) => {
              const isCurrent = page.route === currentRoute
              return (
                <li key={page.route}>
                  <a
                    href={page.route}
                    aria-current={isCurrent ? "page" : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "block rounded-md px-2 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-interactive hover:text-text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      isCurrent &&
                        "bg-surface-interactive font-medium text-text-primary"
                    )}
                  >
                    {page.sidebarLabel ?? page.title}
                  </a>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </nav>
  )
}
