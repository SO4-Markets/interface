import { createFileRoute } from "@tanstack/react-router"
import { Suspense, lazy } from "react"
import { LoadingPage } from "../shared/components/LoadingPage"

const EarnPage = lazy(() =>
  import("../features/earn/components/earn-page").then((m) => ({
    default: m.EarnPage,
  }))
)

export const Route = createFileRoute("/earn")({
  component: () => (
    <Suspense fallback={<LoadingPage />}>
      <EarnPage />
    </Suspense>
  ),
})
