export interface NavPage {
  route: string
  title: string
  sidebarLabel?: string
}

export interface NavSection {
  label: string
  pages: NavPage[]
}

export interface NavMetaSection {
  label: string
  pages: string[]
}

interface IndexedPage {
  route: string
  frontmatter: {
    title: string
    sidebarLabel?: string
  }
}

export interface BreadcrumbItem {
  label: string
  href?: string
}

export interface PagerLinks {
  previous?: NavPage
  next?: NavPage
}

export function buildNavigation(
  metaSections: NavMetaSection[],
  pagesByRoute: ReadonlyMap<string, IndexedPage>
): NavSection[] {
  return metaSections.map((section) => ({
    label: section.label,
    pages: section.pages.map((path) => {
      const route = `/${path}`
      const page = pagesByRoute.get(route)
      if (!page) throw new Error(`navigation references missing page ${route}`)

      return {
        route,
        title: page.frontmatter.title,
        sidebarLabel: page.frontmatter.sidebarLabel,
      }
    }),
  }))
}

export function flattenNavigation(sections: NavSection[]): NavPage[] {
  return sections.flatMap((section) => section.pages)
}

export function getPagerLinks(
  sections: NavSection[],
  currentRoute: string
): PagerLinks {
  const pages = flattenNavigation(sections)
  const index = pages.findIndex((page) => page.route === currentRoute)

  if (index === -1) return {}

  return {
    previous: index > 0 ? pages[index - 1] : undefined,
    next: index < pages.length - 1 ? pages[index + 1] : undefined,
  }
}

export function getBreadcrumbs(
  sections: NavSection[],
  currentRoute: string
): BreadcrumbItem[] {
  for (const section of sections) {
    const page = section.pages.find((item) => item.route === currentRoute)
    if (!page) continue

    return [
      { label: "Docs", href: "/" },
      { label: section.label },
      { label: page.title },
    ]
  }

  return [{ label: "Docs", href: "/" }]
}

export function breadcrumbStructuredData(
  items: BreadcrumbItem[],
  siteUrl: string
) {
  const baseUrl = siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: item.href
        ? new URL(item.href.slice(1), baseUrl).toString()
        : undefined,
    })),
  }
}
