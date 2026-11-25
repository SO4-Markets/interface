import * as React from "react"
import { cn } from "@workspace/ui/lib/utils"

// ---------------------------------------------------------------------------
// Sidebar — documentation navigation driven by meta.json manifests.
//
// Reads sections from a typed NavTree, persists collapse state per section
// in localStorage (with safe fallback), and provides full keyboard
// navigation with visible focus indicators.
// ---------------------------------------------------------------------------

export interface NavItem {
  label: string
  href: string
}

export interface NavSection {
  label: string
  icon?: string
  pages: Array<NavItem>
}

interface SidebarProps {
  sections: Array<NavSection>
  currentPath: string
  className?: string
}

// ---------------------------------------------------------------------------
// Collapse-state persistence (localStorage, try/catch wrapped)
// ---------------------------------------------------------------------------

const STORAGE_KEY = "docs-sidebar-collapse"

function readCollapsedState(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((v): v is string => typeof v === "string"))
  } catch {
    return new Set()
  }
}

function writeCollapsedState(collapsed: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...collapsed]))
  } catch {
    // Storage unavailable — degrade silently.
  }
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export function Sidebar({ sections, currentPath, className }: SidebarProps) {
  const [collapsed, setCollapsed] = React.useState<Set<string>>(readCollapsedState)

  const toggle = React.useCallback((label: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      writeCollapsedState(next)
      return next
    })
  }, [])

  // Auto-expand the section containing the current path.
  React.useEffect(() => {
    for (const section of sections) {
      if (section.pages.some((p) => currentPath.startsWith(p.href))) {
        setCollapsed((prev) => {
          if (!prev.has(section.label)) return prev
          const next = new Set(prev)
          next.delete(section.label)
          writeCollapsedState(next)
          return next
        })
        break
      }
    }
  }, [currentPath, sections])

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest("[data-sidebar]")) return

      const items = [
        ...target.closest("[data-sidebar]")!.querySelectorAll<HTMLElement>(
          '[role="treeitem"]',
        ),
      ]
      const index = items.indexOf(target)

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault()
          items[Math.min(index + 1, items.length - 1)]?.focus()
          break
        }
        case "ArrowUp": {
          e.preventDefault()
          items[Math.max(index - 1, 0)]?.focus()
          break
        }
        case "Home": {
          e.preventDefault()
          items[0]?.focus()
          break
        }
        case "End": {
          e.preventDefault()
          items[items.length - 1]?.focus()
          break
        }
        case "ArrowRight": {
          const section = target.closest("[data-section]")
          if (section?.getAttribute("aria-expanded") === "false") {
            e.preventDefault()
            const label = section.getAttribute("data-section")!
            toggle(label)
          }
          break
        }
        case "ArrowLeft": {
          const section = target.closest("[data-section]")
          if (section?.getAttribute("aria-expanded") === "true") {
            e.preventDefault()
            const label = section.getAttribute("data-section")!
            toggle(label)
          }
          break
        }
      }
    },
    [toggle],
  )

  return (
    <nav
      data-sidebar
      aria-label="Documentation"
      className={cn("flex flex-col gap-1", className)}
      onKeyDown={handleKeyDown}
    >
      {sections.map((section) => {
        const isExpanded = !collapsed.has(section.label)
        const hasActive = section.pages.some(
          (p) => currentPath === p.href,
        )

        return (
          <SidebarSection
            key={section.label}
            section={section}
            isExpanded={isExpanded}
            hasActive={hasActive}
            currentPath={currentPath}
            onToggle={toggle}
          />
        )
      })}
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Section (collapsible group)
// ---------------------------------------------------------------------------

interface SidebarSectionProps {
  section: NavSection
  isExpanded: boolean
  hasActive: boolean
  currentPath: string
  onToggle: (label: string) => void
}

function SidebarSection({
  section,
  isExpanded,
  hasActive,
  currentPath,
  onToggle,
}: SidebarSectionProps) {
  return (
    <div data-section={section.label} aria-expanded={isExpanded}>
      <button
        type="button"
        role="treeitem"
        aria-expanded={isExpanded}
        onClick={() => onToggle(section.label)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm font-medium transition-colors",
          "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          hasActive ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          fill="currentColor"
          className={cn(
            "size-3.5 shrink-0 transition-transform motion-reduce:transition-none",
            isExpanded && "rotate-90",
          )}
        >
          <path d="M6.22 4.22a.75.75 0 011.06 0l3.25 3.25a.75.75 0 010 1.06l-3.25 3.25a.75.75 0 01-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 010-1.06z" />
        </svg>
        {section.label}
      </button>

      {isExpanded && (
        <ul role="group" className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l border-border pl-3">
          {section.pages.map((item) => (
            <SidebarItem
              key={item.href}
              item={item}
              isActive={currentPath === item.href}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Item (single page link)
// ---------------------------------------------------------------------------

interface SidebarItemProps {
  item: NavItem
  isActive: boolean
}

function SidebarItem({ item, isActive }: SidebarItemProps) {
  const ref = React.useRef<HTMLAnchorElement>(null)

  React.useEffect(() => {
    if (isActive) ref.current?.scrollIntoView({ block: "nearest" })
  }, [isActive])

  return (
    <li>
      <a
        ref={ref}
        href={item.href}
        role="treeitem"
        aria-current={isActive ? "page" : undefined}
        tabIndex={0}
        className={cn(
          "block rounded-md px-3 py-1 text-sm transition-colors",
          "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          isActive
            ? "font-medium text-foreground bg-muted/50"
            : "text-muted-foreground",
        )}
      >
        {item.label}
      </a>
    </li>
  )
}

export type { SidebarProps }
