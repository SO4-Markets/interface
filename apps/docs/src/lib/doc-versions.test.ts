import { describe, expect, test } from "vitest"
import {
  resolveVersionSwitchTarget,
  stripVersionPrefix,
  versionedRoute,
  type DocVersionIndex,
  type DocVersionSection,
} from "./doc-versions"

describe("versionedRoute", () => {
  test("leaves the current version's routes unprefixed", () => {
    expect(versionedRoute(null, "/concepts/risk")).toBe("/concepts/risk")
  })

  test("prefixes a route with the version id", () => {
    expect(versionedRoute("v0", "/concepts/risk")).toBe("/v0/concepts/risk")
  })

  test("prefixes the home route without a trailing slash", () => {
    expect(versionedRoute("v0", "/")).toBe("/v0")
  })
})

describe("resolveVersionSwitchTarget", () => {
  const currentSections: ReadonlyArray<DocVersionSection> = [
    { label: "Concepts", pages: ["/concepts/risk", "/concepts/oracles"] },
    { label: "Guides", pages: ["/guides/pools"] },
  ]

  test("links directly when the exact page exists in the target version", () => {
    const target: DocVersionIndex = {
      id: "v0",
      sections: [{ label: "Concepts", pages: ["/concepts/risk"] }],
    }
    expect(resolveVersionSwitchTarget("/concepts/risk", currentSections, target)).toBe(
      "/v0/concepts/risk",
    )
  })

  test("falls back to the same section's first page when the exact page is missing", () => {
    const target: DocVersionIndex = {
      id: "v0",
      sections: [{ label: "Concepts", pages: ["/concepts/oracles"] }],
    }
    // /concepts/risk does not exist in v0's Concepts section, so land on
    // that section's first page instead.
    expect(resolveVersionSwitchTarget("/concepts/risk", currentSections, target)).toBe(
      "/v0/concepts/oracles",
    )
  })

  test("falls back to the version home when the section itself is missing", () => {
    const target: DocVersionIndex = {
      id: "v0",
      sections: [{ label: "Guides", pages: ["/guides/pools"] }],
    }
    expect(resolveVersionSwitchTarget("/concepts/risk", currentSections, target)).toBe("/v0")
  })

  test("resolves to the unprefixed current version when its id is null", () => {
    const target: DocVersionIndex = {
      id: null,
      sections: [{ label: "Concepts", pages: ["/concepts/risk"] }],
    }
    expect(resolveVersionSwitchTarget("/concepts/risk", currentSections, target)).toBe(
      "/concepts/risk",
    )
  })

  test("falls back to the version home when the page is orphaned (no section at all)", () => {
    const target: DocVersionIndex = { id: "v0", sections: [] }
    expect(resolveVersionSwitchTarget("/index", [], target)).toBe("/v0")
  })
})

describe("stripVersionPrefix", () => {
  const known = new Set(["v0", "v1"])

  test("recognises a known version prefix", () => {
    expect(stripVersionPrefix("/v0/concepts/risk", known)).toEqual({
      versionId: "v0",
      route: "/concepts/risk",
    })
  })

  test("maps the bare version segment to that version's home", () => {
    expect(stripVersionPrefix("/v0", known)).toEqual({ versionId: "v0", route: "/" })
  })

  test("treats an unknown leading segment as an unversioned route", () => {
    expect(stripVersionPrefix("/concepts/risk", known)).toEqual({
      versionId: null,
      route: "/concepts/risk",
    })
  })

  test("treats the root path as unversioned", () => {
    expect(stripVersionPrefix("/", known)).toEqual({ versionId: null, route: "/" })
  })
})
