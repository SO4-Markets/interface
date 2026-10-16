import { createFileRoute, notFound } from "@tanstack/react-router"
import { DesignSystemPage } from "@/features/design-system/design-system-page"

export const Route = createFileRoute("/design-system")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) {
      throw notFound()
    }
  },
  component: DesignSystemPage,
})
