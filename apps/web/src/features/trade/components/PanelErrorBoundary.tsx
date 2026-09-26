import { useState } from "react"
import { ErrorState } from "@workspace/ui/components/states"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"

// Issue 686 (OB-039): panel-local recovery.
//
// Wraps a single trading-layout region (chart, book, account tables,
// market header) so a render failure in that region falls back in place
// instead of blanking the rest of the page. Each panel gets its own
// boundary instance, so retrying one panel never unmounts — or
// re-triggers mount animation on — its siblings, and never touches the
// order draft or wallet connection state that live in sibling trees.
//
// Retry remounts only this panel's subtree (via a local key bump), never
// the route: no router navigation or full-page reload is involved.

type PanelErrorBoundaryProps = {
  /** Shown in the fallback message, e.g. "chart", "order book". */
  panel: string
  children: React.ReactNode
}

export function PanelErrorBoundary({ panel, children }: PanelErrorBoundaryProps) {
  const [retryKey, setRetryKey] = useState(0)

  return (
    <ErrorBoundary
      key={retryKey}
      fallback={<PanelErrorFallback panel={panel} onRetry={() => setRetryKey((k) => k + 1)} />}
    >
      {children}
    </ErrorBoundary>
  )
}

function PanelErrorFallback({ panel, onRetry }: { panel: string; onRetry: () => void }) {
  return (
    <ErrorState
      className="h-full"
      title={`Couldn't load the ${panel}`}
      description="The rest of the page is still usable. Retrying this panel won't affect your open draft or wallet connection."
      onRetry={onRetry}
    />
  )
}
