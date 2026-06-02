import { xdr } from "@stellar/stellar-sdk"

const CODE_LENGTH = 32

/** Encode a human referral code into the BytesN<32> the contract expects. */
export function referralCodeToScVal(code: string): xdr.ScVal {
  const normalized = code.toUpperCase().trim()
  const bytes = Buffer.alloc(CODE_LENGTH, 0)
  Buffer.from(normalized, "utf8").copy(bytes, 0, 0, Math.min(CODE_LENGTH, normalized.length))
  return xdr.ScVal.scvBytes(bytes)
}

/** Decode BytesN<32> from chain into a display referral code (trim trailing nulls). */
export function scValToReferralCode(value: unknown): string | null {
  if (!value) return null

  if (value instanceof Uint8Array) {
    const text = Buffer.from(value).toString("utf8").replace(/\0+$/g, "").trim()
    return text.length > 0 ? text : null
  }

  if (typeof value === "string") {
    const trimmed = value.replace(/\0+$/g, "").trim()
    return trimmed.length > 0 ? trimmed : null
  }

  if (typeof value === "object" && value !== null && "code" in value) {
    return scValToReferralCode((value as { code: unknown }).code)
  }

  return null
}

export const AFFILIATE_CODE_STORAGE_KEY = "so4-affiliate-code"
export const REFERRAL_PROMPT_STORAGE_KEY = "so4-referral-prompt-done"
export const REFERRAL_CODE_STORAGE_KEY = "so4-referral-code"

export function affiliateCodeStorageKey(account: string): string {
  return `${AFFILIATE_CODE_STORAGE_KEY}:${account}`
}

export function saveReferralCode(code: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(REFERRAL_CODE_STORAGE_KEY, code.toUpperCase().trim())
}

export function readStoredReferralCode(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(REFERRAL_CODE_STORAGE_KEY)
}

export function referralPromptStorageKey(account: string): string {
  return `${REFERRAL_PROMPT_STORAGE_KEY}:${account}`
}
