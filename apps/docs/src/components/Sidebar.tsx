import React from "react"
import { Link } from "@tanstack/react-router"
import { cn } from "@workspace/ui/lib/utils"

export interface SidebarSection {
  label: string
  icon?: string
  pages: Array<{
    route: string
    title: string
    sidebarLabel?: string
    status?: "stable" | "beta" | "draft"
  }>
}

export interface SidebarProps {
  sections: SidebarSection[]
  currentRoute: string
  className?: string
}

export function Sidebar({ sections, currentRoute, className }: SidebarProps) {
  return (
    <aside
      aria-label="Documentation navigation"
      className={cn("w-64 flex-shrink-0 border-r border-border p-4 space-y-6", className)}
    >
      {sections.map((section) => (
        <div key={section.label} className="space-y-2">
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
            {section.label}
          </h3>
          <ul className="space-y-1">
            {section.pages.map((page) => {
              const isActive = currentRoute === page.route
              return (
                <li key={page.route}>
                  <Link
                    to={page.route}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "block px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "bg-surface-accent text-text-accent font-semibold"
                        : "text-text-secondary hover:text-text-primary hover:bg-surface-hover",
                    )}
                  >
                    {page.sidebarLabel ?? page.title}
                    {page.status === "beta" && (
                      <span className="ml-2 px-1.5 py-0.5 text-10 rounded bg-warning-subtle text-warning-foreground font-mono">
                        beta
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </aside>
  )
}
