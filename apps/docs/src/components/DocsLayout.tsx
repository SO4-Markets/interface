"use client"

import type { ReactNode } from "react"
import { Menu01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/ui/components/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import { Icon } from "@workspace/ui/components/icon"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"
import { MAIN_CONTENT_ID, SkipLink } from "@workspace/ui/components/skip-link"
import { ReadingProgress } from "./ReadingProgress"

export interface DocsLayoutProps {
  header?: ReactNode
  sidebar: ReactNode
  toc?: ReactNode
  footer?: ReactNode
  children: ReactNode
}

export function DocsLayout({
  header,
  sidebar,
  toc,
  footer,
  children,
}: DocsLayoutProps) {
  return (
    <div
      data-slot="docs-shell"
      className="min-h-dvh overflow-x-clip bg-surface-canvas text-text-primary"
    >
      <SkipLink />
      <header
        data-slot="docs-header"
        className="sticky top-0 z-40 border-b border-border bg-surface-canvas relative"
      >
        <ReadingProgress />
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center gap-3 px-4 md:px-6 lg:px-8">
          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Open documentation navigation"
                  />
                }
              >
                <Icon icon={Menu01Icon} size="md" />
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-6">
                <SheetTitle>Documentation</SheetTitle>
                <SheetDescription>
                  Browse documentation sections and pages.
                </SheetDescription>
                <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
                  {sidebar}
                </div>
              </SheetContent>
            </Sheet>
          </div>
          <div className="min-w-0 flex-1">{header}</div>
        </div>
      </header>

      <div className="mx-auto flex max-w-screen-2xl items-start px-4 md:px-6 lg:px-8">
        <aside
          data-slot="docs-sidebar"
          className="sticky top-16 hidden max-h-[calc(100dvh-4rem)] w-56 shrink-0 overflow-y-auto py-8 pe-6 lg:block xl:w-64"
        >
          {sidebar}
        </aside>

        <main
          id={MAIN_CONTENT_ID}
          tabIndex={-1}
          className="min-w-0 flex-1 py-8 outline-none lg:px-8 xl:px-12"
          data-pagefind-body
        >
          {toc ? (
            <Collapsible className="mb-8 xl:hidden">
              <CollapsibleTrigger className="border-y border-border py-3">
                On this page
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">{toc}</CollapsibleContent>
            </Collapsible>
          ) : null}
          <article className="mx-auto max-w-3xl">{children}</article>
        </main>

        {toc ? (
          <aside
            data-slot="docs-toc"
            className="sticky top-16 hidden max-h-[calc(100dvh-4rem)] w-56 shrink-0 overflow-y-auto py-8 ps-6 xl:block"
          >
            <nav aria-label="On this page">{toc}</nav>
          </aside>
        ) : null}
      </div>

      {footer ? (
        <footer
          data-slot="docs-footer"
          className="border-t border-border px-4 py-8 md:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-screen-2xl">{footer}</div>
        </footer>
      ) : null}
    </div>
  )
}
