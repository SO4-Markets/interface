const RPC_ERROR_MESSAGES: Record<string, string> = {
  tx_bad_auth: "Transaction signature invalid. Try reconnecting your wallet.",
  tx_bad_auth_extra: "Transaction contains unexpected signatures. Try reconnecting your wallet.",
  tx_bad_seq: "Transaction sequence is out of date. Refresh and try again.",
  tx_insufficient_balance: "Wallet balance is too low to submit this transaction.",
  tx_insufficient_fee: "Transaction fee is too low. Try again with a higher fee.",
  tx_too_early: "Transaction submitted too early. Wait a moment and try again.",
  tx_too_late: "Transaction expired. Please try again.",
  op_exceeded_work_limit: "Transaction too complex. Try a smaller position.",
  op_no_account: "Destination account was not found.",
  op_underfunded: "Wallet balance is too low for this operation.",
}

const CONTRACT_ERROR_MESSAGES: Record<string, string> = {
  INSUFFICIENT_COLLATERAL: "Insufficient collateral for this position.",
  INSUFFICIENT_LIQUIDITY: "Insufficient liquidity for this trade.",
  INSUFFICIENT_OUTPUT_AMOUNT: "Output amount is below your minimum.",
  INVALID_MARKET: "This market is not available.",
  INVALID_ORDER: "Order parameters are invalid.",
  INVALID_PRICE: "Price is outside the allowed range.",
  LEVERAGE_TOO_HIGH: "Leverage is above the maximum allowed for this market.",
  MARKET_CLOSED: "This market is currently closed.",
  ORDER_NOT_FOUND: "Order was not found or has already been executed.",
  POSITION_NOT_FOUND: "Position was not found.",
  SLIPPAGE_EXCEEDED: "Price moved beyond your slippage limit. Try again.",
  UNAUTHORIZED: "You are not authorized to perform this action.",
}

const FALLBACK_MESSAGE = "Transaction failed. Please try again."

export function parseSorobanError(error: unknown): string {
  const text = collectErrorText(error).join(" ")
  const upperText = text.toUpperCase()

  for (const [code, message] of Object.entries(CONTRACT_ERROR_MESSAGES)) {
    if (hasToken(upperText, code)) {
      return message
    }
  }

  const normalizedText = text.toLowerCase()

  for (const [code, message] of sortedErrorMessages(RPC_ERROR_MESSAGES)) {
    if (normalizedText.includes(code)) {
      return message
    }
  }

  if (normalizedText.includes("simulation failed")) {
    return "Transaction simulation failed. Check the details and try again."
  }

  if (normalizedText.includes("resource") || normalizedText.includes("budget")) {
    return "Transaction resources exceeded. Try a smaller position."
  }

  if (normalizedText.includes("timeout") || normalizedText.includes("try_again_later")) {
    return "Network is busy. Please try again in a moment."
  }

  if (normalizedText.includes("rejected") || normalizedText.includes("user declined")) {
    return "Transaction was rejected in your wallet."
  }

  return FALLBACK_MESSAGE
}

function collectErrorText(error: unknown, seen = new Set<unknown>()): string[] {
  if (error === null || error === undefined || seen.has(error)) {
    return []
  }

  if (typeof error === "string") {
    return collectStringText(error)
  }

  if (typeof error === "number" || typeof error === "boolean") {
    return [String(error)]
  }

  if (error instanceof Error) {
    seen.add(error)

    return [
      error.name,
      error.message,
      ...collectErrorText(error.cause, seen),
    ]
  }

  if (typeof error !== "object") {
    return []
  }

  seen.add(error)

  return Object.values(error as Record<string, unknown>).flatMap((value) =>
    collectErrorText(value, seen),
  )
}

function collectStringText(value: string): string[] {
  const trimmed = value.trim()

  if (!trimmed) {
    return []
  }

  if (!looksLikeJson(trimmed)) {
    return [trimmed]
  }

  try {
    return [trimmed, ...collectErrorText(JSON.parse(trimmed))]
  } catch {
    return [trimmed]
  }
}

function hasToken(text: string, token: string): boolean {
  return new RegExp(`(^|[^A-Z0-9_])${token}([^A-Z0-9_]|$)`).test(text)
}

function looksLikeJson(value: string): boolean {
  return (
    (value.startsWith("{") && value.endsWith("}")) ||
    (value.startsWith("[") && value.endsWith("]"))
  )
}

function sortedErrorMessages(messages: Record<string, string>) {
  return Object.entries(messages).sort(([left], [right]) => right.length - left.length)
}
