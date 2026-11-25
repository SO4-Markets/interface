export const OFFLINE_TRANSACTION_MESSAGE =
  "You’re offline. Reconnect before signing or submitting. No transaction was queued."

/** Fail closed before wallet signing or transaction broadcast when offline. */
export function assertOnlineForTransaction(): void {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error(OFFLINE_TRANSACTION_MESSAGE)
  }
}