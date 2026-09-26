/** DX-050: versioned documentation routing.
 *
 * The current version is served unprefixed, unchanged from DX-029. Any
 * frozen snapshot lives under an explicit `/<versionId>` prefix. This module
 * is pure route arithmetic — build.ts uses it at build time to decide, for
 * each rendered page, exactly which URL every other version's picker entry
 * and every version banner's "view the current version" link should point
 * to. Nothing here reads the filesystem.
 */

export interface DocVersionSection {
  label: string
  /** Full routes, each starting with "/", e.g. "/concepts/risk". */
  pages: ReadonlyArray<string>
}

export interface DocVersionIndex {
  /** null identifies the current, unprefixed version. */
  id: string | null
  sections: ReadonlyArray<DocVersionSection>
}

/** Prefixes a route with a version id, or returns it unchanged for the
 * current version. `"/"` becomes `"/v0"`, not `"/v0/"`. */
export function versionedRoute(versionId: string | null, route: string): string {
  if (!versionId) return route
  return route === "/" ? `/${versionId}` : `/${versionId}${route}`
}

function findSectionForRoute(
  sections: ReadonlyArray<DocVersionSection>,
  route: string,
): DocVersionSection | null {
  return sections.find((section) => section.pages.includes(route)) ?? null
}

/** Resolves where a version switch should land. Exact match wins; failing
 * that, the same-labelled section's first page in the target version (its
 * "section index"); failing that, the target version's home. */
export function resolveVersionSwitchTarget(
  currentRoute: string,
  currentSections: ReadonlyArray<DocVersionSection>,
  target: DocVersionIndex,
): string {
  const targetRoutes = new Set(target.sections.flatMap((section) => section.pages))
  if (targetRoutes.has(currentRoute)) return versionedRoute(target.id, currentRoute)

  const currentSection = findSectionForRoute(currentSections, currentRoute)
  if (currentSection) {
    const targetSection = target.sections.find((section) => section.label === currentSection.label)
    if (targetSection && targetSection.pages.length > 0) {
      return versionedRoute(target.id, targetSection.pages[0])
    }
  }

  return versionedRoute(target.id, "/")
}

/** Splits a request path into a known version id (if the leading segment
 * matches one) and the route within that version. Used only where routing
 * needs to go the other direction — from a URL back to a version + route. */
export function stripVersionPrefix(
  pathname: string,
  knownVersionIds: ReadonlySet<string>,
): { versionId: string | null; route: string } {
  const match = pathname.match(/^\/([a-z0-9-]+)(\/.*)?$/)
  const candidate = match?.[1]
  if (candidate && knownVersionIds.has(candidate)) {
    const rest = match?.[2]
    return { versionId: candidate, route: rest && rest.length > 0 ? rest : "/" }
  }
  return { versionId: null, route: pathname }
}
