import { useEffect, useState } from "react"
import { ledgerReconciliation } from "../lib/ledger-reconciliation"
import type { ConfirmedLedgerEvidence } from "../lib/ledger-reconciliation"

export function useLedgerReconciliation(account?: string) {
  const [evidences, setEvidences] = useState<Array<ConfirmedLedgerEvidence>>(() =>
    ledgerReconciliation.getEvidences(account),
  )

  useEffect(() => {
    setEvidences(ledgerReconciliation.getEvidences(account))
    const unsubscribe = ledgerReconciliation.subscribe(() => {
      setEvidences(ledgerReconciliation.getEvidences(account))
    })

    const timeoutInterval = setInterval(() => {
      ledgerReconciliation.checkTimeouts()
    }, 2000)

    return () => {
      unsubscribe()
      clearInterval(timeoutInterval)
    }
  }, [account])

  return {
    evidences,
    activeSyncing: evidences.filter((e) => e.status === "syncing"),
    timedOut: evidences.filter((e) => e.status === "sync-timeout"),
    retrySync: (id: string) => ledgerReconciliation.retrySync(id),
    markCaughtUp: (id: string) => ledgerReconciliation.markCaughtUp(id),
  }
}
