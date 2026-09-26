import {
  Breadcrumb,
  BreadcrumbItem as BreadcrumbPrimitiveItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"

import type { BreadcrumbItem } from "../lib/navigation"

interface DocsBreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function DocsBreadcrumbs({ items }: DocsBreadcrumbsProps) {
  return (
    <Breadcrumb className="mb-6">
      {items.map((item, index) => {
        const isCurrent = index === items.length - 1
        return (
          <BreadcrumbPrimitiveItem
            key={`${item.label}-${index}`}
            isCurrent={isCurrent}
          >
            {item.href && !isCurrent ? (
              <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
            ) : (
              <BreadcrumbLink as="span">{item.label}</BreadcrumbLink>
            )}
            {!isCurrent ? <BreadcrumbSeparator /> : null}
          </BreadcrumbPrimitiveItem>
        )
      })}
    </Breadcrumb>
  )
}
