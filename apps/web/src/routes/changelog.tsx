import { createFileRoute } from "@tanstack/react-router"
import { AppShell } from "@workspace/ui/components/app-shell"
import { Navbar } from "../ui/Navbar"
import { ChangelogPage } from "../features/changelog/components/ChangelogPage"
import { validateChangelogSearch } from "../features/changelog/search"

export const Route = createFileRoute("/changelog")({
  component: ChangelogRoute,
  validateSearch: validateChangelogSearch,
})

function ChangelogRoute() {
  return (
    <AppShell navbar={<Navbar variant="app" />} maxWidth="3xl">
      <ChangelogPage />
    </AppShell>
  )
}
