import { createFileRoute } from "@tanstack/react-router"
import { ChangelogPage } from "../features/changelog/components/ChangelogPage"
import { validateChangelogSearch } from "../features/changelog/search"

export const Route = createFileRoute("/changelog")({
  component: ChangelogPage,
  validateSearch: validateChangelogSearch,
})
