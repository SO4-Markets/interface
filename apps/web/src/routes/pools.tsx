import { createFileRoute } from "@tanstack/react-router"
import { Suspense, lazy } from "react"
import { LoadingPage } from "../shared/components/LoadingPage"
import { optionalSearchString } from "../shared/lib/table-sort"

const PoolsPage = lazy(() =>
  import("../features/pools/components/pools-page").then((m) => ({
    default: m.PoolsPage,
  }))
)

/** `sort` persists the GM pools table order, e.g. /pools?sort=tvl.desc (issue 966). */
export type PoolsSearch = {
  sort?: string
}

export const Route = createFileRoute("/pools")({
  component: () => (
    <Suspense fallback={<LoadingPage />}>
      <PoolsPage />
    </Suspense>
  ),
  validateSearch: (search: Record<string, unknown>): PoolsSearch => ({
    sort: optionalSearchString(search.sort),
  }),
})
