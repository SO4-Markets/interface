import type { BreadcrumbItem } from "../lib/navigation"
import { breadcrumbStructuredData } from "../lib/navigation"

interface BreadcrumbStructuredDataProps {
  items: BreadcrumbItem[]
  siteUrl?: string
}

export function BreadcrumbStructuredData({
  items,
  siteUrl = "https://docs.so4.market",
}: BreadcrumbStructuredDataProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(breadcrumbStructuredData(items, siteUrl)),
      }}
    />
  )
}
