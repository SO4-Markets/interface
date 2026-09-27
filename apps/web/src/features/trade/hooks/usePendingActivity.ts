import { useEffect, useState } from "react"
import { pendingActivity } from "../lib/pending-activity"
import type { PendingActivityItem } from "../lib/pending-activity"

export function usePendingActivity(account?: string) {
  const [activities, setActivities] = useState<Array<PendingActivityItem>>(() =>
    pendingActivity.getActivities(account),
  )

  useEffect(() => {
    setActivities(pendingActivity.getActivities(account))
    const unsubscribe = pendingActivity.subscribe(() => {
      setActivities(pendingActivity.getActivities(account))
    })
    return () => unsubscribe()
  }, [account])

  const pendingMargin = pendingActivity.getPendingMarginReservations(account)

  return {
    activities,
    inFlightCount: activities.filter((a) => a.stage === "submitting" || a.stage === "confirming").length,
    pendingMargin,
    addActivity: pendingActivity.addActivity.bind(pendingActivity),
    updateStage: pendingActivity.updateStage.bind(pendingActivity),
    removeActivity: pendingActivity.removeActivity.bind(pendingActivity),
  }
}
