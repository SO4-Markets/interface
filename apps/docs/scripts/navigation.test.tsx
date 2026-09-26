import { describe, expect, test } from "bun:test"
import { contentRoot, loadContentIndex } from "../src/lib/content"
import {
  breadcrumbStructuredData,
  buildNavigation,
  flattenNavigation,
  getBreadcrumbs,
  getPagerLinks,
  type NavMetaSection,
} from "../src/lib/navigation"

async function loadActualNavigation() {
  const meta = (await Bun.file(`${contentRoot}/meta.json`).json()) as {
    sections: NavMetaSection[]
  }
  const index = await loadContentIndex("development")
  return buildNavigation(meta.sections, index.byRoute)
}

describe("documentation navigation", () => {
  test("breadcrumbs and pagers follow every page in sidebar order", async () => {
    const navigation = await loadActualNavigation()
    const pages = flattenNavigation(navigation)

    for (const [index, page] of pages.entries()) {
      const pager = getPagerLinks(navigation, page.route)
      expect(pager.previous).toEqual(index > 0 ? pages[index - 1] : undefined)
      expect(pager.next).toEqual(
        index < pages.length - 1 ? pages[index + 1] : undefined
      )

      const crumbs = getBreadcrumbs(navigation, page.route)
      expect(crumbs.at(-1)?.label).toBe(page.title)
    }
  })

  test("boundary pages expose only the available pager link", async () => {
    const navigation = await loadActualNavigation()
    const pages = flattenNavigation(navigation)
    const first = getPagerLinks(navigation, pages[0].route)
    const last = getPagerLinks(navigation, pages.at(-1)!.route)

    expect(first.previous).toBeUndefined()
    expect(first.next).toBeDefined()
    expect(last.previous).toBeDefined()
    expect(last.next).toBeUndefined()
  })

  test("emits ordered BreadcrumbList structured data", () => {
    const items = [
      { label: "Docs", href: "/" },
      { label: "Developers" },
      { label: "Architecture" },
    ]
    const data = breadcrumbStructuredData(items, "https://docs.so4.market")
    expect(data["@type"]).toBe("BreadcrumbList")
    expect(data.itemListElement.map((item) => item.position)).toEqual([1, 2, 3])
    expect(data.itemListElement[0].item).toBe("https://docs.so4.market/")
  })
})
