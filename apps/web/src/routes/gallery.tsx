import { createFileRoute, notFound } from "@tanstack/react-router"
import { GalleryPage } from "../features/gallery/components/gallery-page"

export const Route = createFileRoute("/gallery")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) {
      throw notFound()
    }
  },
  component: GalleryPage,
})
