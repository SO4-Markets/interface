import { usePendingContent } from "../hooks/usePendingContent"
import type { ReactNode } from "react"

interface PendingContentProps {
  /** Whether data is currently loading */
  isLoading: boolean
  /** Data or any truthy value indicating content is available */
  data: unknown
  /** Component to render when in pending state (skeleton) */
  pendingComponent: ReactNode
  /** Component to render when content is available */
  children: ReactNode
  /** Component to render when loading but showing content (background refetch) */
  overlay?: ReactNode
  /** Custom loading delay in ms before showing skeleton (default 300ms) */
  loadingDelay?: number
  /** CSS class for the container */
  className?: string
}

/**
 * Manages transitions between pending (skeleton) and content states,
 * preventing skeleton flashing on warm cache reads.
 *
 * On first load: shows skeleton while loading, then content when data arrives
 * On background refetch: keeps content visible, optionally shows overlay
 *
 * @example
 * ```tsx
 * <PendingContent
 *   isLoading={query.isLoading}
 *   data={query.data}
 *   pendingComponent={<SkeletonText lines={3} />}
 *   overlay={query.isLoading && <LoadingOverlay />}
 * >
 *   <OrderBook orders={data.orders} />
 * </PendingContent>
 * ```
 */
export function PendingContent({
  isLoading,
  data,
  pendingComponent,
  children,
  overlay,
  loadingDelay = 300,
  className,
}: PendingContentProps) {
  const { shouldShowSkeleton, shouldShowContent, isFirstLoad } = usePendingContent(
    isLoading,
    data,
    loadingDelay
  )

  if (shouldShowSkeleton) {
    return <div className={className}>{pendingComponent}</div>
  }

  return (
    <div className={className}>
      {shouldShowContent && children}
      {isLoading && !isFirstLoad && overlay}
    </div>
  )
}
