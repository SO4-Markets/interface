"use client"

import { useEffect, useState, useRef } from "react"
import { cn } from "@workspace/ui/lib/utils"

export interface TocEntry {
  title: string
  id: string
  level?: number
}

export interface TocProps {
  entries: TocEntry[]
  activeId?: string
  className?: string
  onSelect?: (id: string) => void
}

export function Toc({
  entries,
  activeId: initialActiveId,
  className,
  onSelect,
}: TocProps) {
  // Only h2 and h3 headings are included in the table of contents
  const validEntries = entries.filter(
    (e) => !e.level || e.level === 2 || e.level === 3
  )

  const [activeId, setActiveId] = useState<string>(
    initialActiveId || validEntries[0]?.id || ""
  )
  const isClickRef = useRef(false)

  useEffect(() => {
    if (
      validEntries.length < 2 ||
      typeof window === "undefined" ||
      typeof IntersectionObserver === "undefined"
    )
      return

    // Hold last heading when scrolled to bottom of document
    const handleScroll = () => {
      if (isClickRef.current) return
      const isBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 50

      if (isBottom && validEntries.length > 0) {
        setActiveId(validEntries[validEntries.length - 1].id)
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })

    const observer = new IntersectionObserver(
      (intersectingEntries) => {
        if (isClickRef.current) return

        const visible = intersectingEntries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)

        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      {
        rootMargin: "0px 0px -70% 0px",
        threshold: [0, 1.0],
      }
    )

    validEntries.forEach((entry) => {
      const element = document.getElementById(entry.id)
      if (element) {
        observer.observe(element)
      }
    })

    return () => {
      window.removeEventListener("scroll", handleScroll)
      observer.disconnect()
    }
  }, [validEntries])

  // DX-032: Pages with < 2 headings render no rail and re-center content
  if (validEntries.length < 2) return null

  const handleLinkClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    id: string
  ) => {
    isClickRef.current = true
    setActiveId(id)
    onSelect?.(id)

    const target = document.getElementById(id)
    if (target) {
      if (!target.hasAttribute("tabindex")) {
        target.setAttribute("tabindex", "-1")
      }
      target.focus({ preventScroll: true })
    }

    setTimeout(() => {
      isClickRef.current = false
    }, 800)
  }

  return (
    <nav
      aria-label="Table of contents"
      className={cn(
        "w-56 flex-shrink-0 text-sm space-y-3 p-4",
        className
      )}
    >
      <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
        On this page
      </h4>
      <ul className="space-y-1.5">
        {validEntries.map((entry) => {
          const isActive = activeId === entry.id
          const isH3 = entry.level === 3
          return (
            <li
              key={entry.id}
              className={cn("transition-colors", isH3 && "ps-3 text-xs")}
            >
              <a
                href={`#${entry.id}`}
                onClick={(e) => handleLinkClick(e, entry.id)}
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "block py-0.5 transition-colors",
                  isActive
                    ? "text-text-accent font-semibold"
                    : "text-text-secondary hover:text-text-primary font-normal"
                )}
              >
                {entry.title}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
