import { createFileRoute } from "@tanstack/react-router"
import { Suspense, lazy } from "react"
import { LoadingPage } from "../shared/components/LoadingPage"

const PoolsPage = lazy(() =>
  import("../features/pools/components/pools-page").then((m) => ({
    default: m.PoolsPage,
  }))
)

export const Route = createFileRoute("/pools")({
  component: () => (
    <Suspense fallback={<LoadingPage />}>
      <PoolsPage />
    </Suspense>
  ),
})
