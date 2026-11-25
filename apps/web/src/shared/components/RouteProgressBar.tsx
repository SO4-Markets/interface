import { useRouterState } from "@tanstack/react-router"
import { cn } from "@workspace/ui/lib/utils"

export function RouteProgressBar() {
  const isLoading = useRouterState({ select: (state) => state.isLoading })

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden"
    >
      <div
        className={cn(
          "h-full origin-left bg-primary transition-[transform,opacity] duration-slow ease-in-out motion-reduce:transition-none",
          isLoading ? "scale-x-75 opacity-100" : "scale-x-0 opacity-0"
        )}
      />
    </div>
  )
}
