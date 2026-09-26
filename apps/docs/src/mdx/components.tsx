import React from "react"
import type { MDXComponents } from "mdx/types"
import { Link } from "@tanstack/react-router"
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons"
import { Icon } from "@workspace/ui/components/icon"

import { cn } from "@workspace/ui/lib/utils"
import { Heading, Text } from "@workspace/ui/components/text"
import { Callout } from "@workspace/ui/components/callout"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@workspace/ui/components/table"
import { CodeGroup } from "./CodeGroup"
import { parseMermaid, renderMermaidSvg } from "../lib/mermaid"

export interface TabsProps {
  children: React.ReactNode
  defaultValue?: string
  className?: string
}

export function Tabs({ children, defaultValue, className }: TabsProps) {
  const childrenArray = React.Children.toArray(children)
  const [activeTab, setActiveTab] = React.useState<number>(0)

  return (
    <div className={cn("my-6 border border-border rounded-xl overflow-hidden", className)}>
      <div className="flex border-b border-border bg-surface-sunken" data-tab-list>
        {childrenArray.map((child: any, idx: number) => {
          const label = child?.props?.label || `Tab ${idx + 1}`
          return (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveTab(idx)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
                activeTab === idx
                  ? "border-primary text-text-primary bg-surface-canvas font-semibold"
                  : "border-transparent text-text-tertiary hover:text-text-secondary",
              )}
            >
              {label}
            </button>
          )
        })}
      </div>
      {/*
        Every panel stays mounted (inactive ones carry the `hidden` attribute)
        so hidden panels remain searchable and can be expanded by the print
        stylesheet — same convention as the primitives-based `Tabs`, whose
        panels use `keepMounted`.
      */}
      <div className="p-4">
        {childrenArray.map((child: any, idx: number) => (
          <div
            key={idx}
            data-tab-panel
            data-tab-label={child?.props?.label || `Tab ${idx + 1}`}
            hidden={idx !== activeTab}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  )
}

export interface TabItemProps {
  label: string
  children: React.ReactNode
}

export function TabItem({ children }: TabItemProps) {
  return <div>{children}</div>
}

export interface StepsProps {
  children: React.ReactNode
  className?: string
}

export function Steps({ children, className }: StepsProps) {
  return (
    <ol className={cn("steps my-6 list-none pl-0 space-y-4", className)}>
      {children}
    </ol>
  )
}

export interface CodeBlockProps {
  children: React.ReactNode
  filename?: string
  language?: string
  className?: string
}

export function CodeBlock({ children, filename, language, className }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = () => {
    const text = typeof children === "string" ? children : ""
    if (text && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className={cn("my-6 rounded-xl border border-border overflow-hidden bg-surface-sunken", className)}>
      {filename && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface-elevated text-xs font-mono text-text-secondary">
          <span>{filename}</span>
          <button
            type="button"
            onClick={handleCopy}
            className="text-text-tertiary hover:text-text-primary transition-colors"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}
      <div className="p-4 overflow-x-auto text-sm font-mono">{children}</div>
    </div>
  )
}

export interface ParamTableProps {
  params: Array<{ name: string; type: string; required?: boolean; description: string }>
}

export function ParamTable({ params }: ParamTableProps) {
  return (
    <div className="my-6 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Parameter</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Required</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {params.map((param) => (
            <TableRow key={param.name}>
              <TableCell className="font-mono font-medium">{param.name}</TableCell>
              <TableCell className="font-mono text-xs text-text-secondary">{param.type}</TableCell>
              <TableCell>{param.required ? "Yes" : "No"}</TableCell>
              <TableCell>{param.description}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export interface ContractAddressProps {
  contract: string
  address: string
}

export function ContractAddress({ contract, address }: ContractAddressProps) {
  return (
    <div className="my-4 p-3 rounded-lg border border-border bg-surface-sunken flex items-center justify-between font-mono text-xs">
      <span className="font-semibold text-text-primary">{contract}</span>
      <span className="text-text-secondary bg-surface-canvas px-2 py-1 rounded border border-border">{address}</span>
    </div>
  )
}

export interface MermaidProps {
  chart: string
  caption?: string
  title?: string
  className?: string
}

export function Mermaid({ chart, caption, title, className }: MermaidProps) {
  const meta = { caption, title }
  const ast = parseMermaid(chart, meta)
  const id = React.useId().replace(/:/g, "_")
  const rendered = renderMermaidSvg(ast, meta, id)
  const captionId = `caption-${id}`

  return (
    <figure
      className={cn(
        "mermaid-wrapper my-6 rounded-xl border border-border bg-surface-sunken overflow-hidden",
        className
      )}
      role="figure"
      aria-labelledby={captionId}
    >
      <div
        className="mermaid-scroll overflow-x-auto p-4 md:p-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        tabIndex={0}
        role="region"
        aria-label="Diagram content"
      >
        <div
          className="mermaid-diagram mermaid-diagram-light block dark:hidden"
          dangerouslySetInnerHTML={{ __html: rendered.lightSvg }}
        />
        <div
          className="mermaid-diagram mermaid-diagram-dark hidden dark:block"
          dangerouslySetInnerHTML={{ __html: rendered.darkSvg }}
        />
      </div>
      <figcaption
        id={captionId}
        className="mermaid-caption px-4 py-2 border-t border-border bg-surface-elevated text-xs font-sans text-text-secondary text-center"
      >
        {rendered.caption}
      </figcaption>
    </figure>
  )
}

export const components: MDXComponents = {
  h1: (props) => <Heading level={1} {...props} />,
  h2: (props) => <Heading level={2} {...props} />,
  h3: (props) => <Heading level={3} {...props} />,
  h4: (props) => <Heading level={4} {...props} />,
  h5: (props) => <Text weight="bold" {...props} />,
  h6: (props) => <Text weight="medium" {...props} />,
  p: (props) => <Text className={cn("mb-4", props.className)} {...props} />,
  code: (props) => {
    if (props.className?.includes("shiki")) {
      return <code {...props} />
    }
    return (
      <code
        {...props}
        className={cn(
          "rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-sm text-text-primary",
          props.className
        )}
      />
    )
  },
  blockquote: ({ children, ...props }) => (
    <div className="my-6">
      <Callout variant="note" {...props}>
        {children}
      </Callout>
    </div>
  ),
  table: (props) => (
    <div className="my-6 w-full">
      <Table {...props} />
    </div>
  ),
  thead: TableHeader,
  tbody: TableBody,
  tr: TableRow,
  th: TableHead,
  td: TableCell,
  a: ({ href, children, ...props }) => {
    if (href?.startsWith("/")) {
      return (
        <Link
          to={href}
          preload="intent"
          className="font-medium text-primary hover:underline"
          {...props}
        >
          {children}
        </Link>
      )
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
        {...props}
      >
        {children}
        <Icon
          icon={ArrowUpRight01Icon}
          size="sm"
          className="ml-0.5 inline-block text-text-tertiary"
        />
      </a>
    )
  },
  ul: (props) => (
    <ul
      className="mb-4 list-disc space-y-2 pl-6 text-sm text-text-primary"
      {...props}
    />
  ),
  ol: (props) => (
    <ol
      className="mb-4 list-decimal space-y-2 pl-6 text-sm text-text-primary"
      {...props}
    />
  ),
  li: (props) => <li {...props} />,
  hr: (props) => <hr className="my-8 border-border" {...props} />,
  img: (props) => (
    <img
      className="my-6 h-auto max-w-full rounded-lg border border-border"
      {...props}
    />
  ),
  Callout: (props: any) => <Callout {...props} />,
  Tabs: (props: any) => <Tabs {...props} />,
  TabItem: (props: any) => <TabItem {...props} />,
  Steps: (props: any) => <Steps {...props} />,
  CodeBlock: (props: any) => <CodeBlock {...props} />,
  ParamTable: (props: any) => <ParamTable {...props} />,
  ContractAddress: (props: any) => <ContractAddress {...props} />,
  Mermaid: (props: any) => <Mermaid {...props} />,
}
