import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  applyReferralCode,
  hasCompletedReferralPrompt,
  markReferralPromptComplete,
  validateReferralCode,
} from "@/features/referrals/lib/referrals"
import { getTraderReferralCode } from "@/lib/soroban/referral-storage"
import { readStoredReferralCode } from "@/lib/soroban/referral-code"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/shared/lib/query-keys"

type Props = {
  account: string | null
}

export function ApplyReferralCodePrompt({ account }: Props) {
  const queryClient = useQueryClient()
  const [code, setCode] = useState(() => readStoredReferralCode() ?? "")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const { data: existingCode, isLoading } = useQuery({
    queryKey: ["referrals", "trader-code", account],
    queryFn: () => getTraderReferralCode(account as string),
    enabled: !!account,
    staleTime: 30_000,
  })

  if (!account || dismissed || isLoading) return null
  if (existingCode || hasCompletedReferralPrompt(account)) return null

  async function handleApply() {
    const err = validateReferralCode(code)
    if (err) {
      setError(err)
      return
    }

    setError(null)
    setPending(true)
    try {
      await applyReferralCode(account as string, code.toUpperCase().trim())
      markReferralPromptComplete(account as string)
      await queryClient.invalidateQueries({ queryKey: queryKeys.referrals.code(account) })
      await queryClient.invalidateQueries({ queryKey: ["referrals", "trader-code", account] })
      setDismissed(true)
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Failed to apply code")
    } finally {
      setPending(false)
    }
  }

  function handleSkip() {
    markReferralPromptComplete(account as string)
    setDismissed(true)
  }

  return (
    <div className="mt-2 rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs font-medium text-foreground">I have a referral code</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Apply once to receive a fee discount on your trades.
      </p>
      <div className="mt-2 flex gap-2">
        <Input
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase())
            setError(null)
          }}
          placeholder="e.g. MYCODE123"
          className="h-8 font-mono text-xs tracking-widest"
          autoComplete="off"
          spellCheck={false}
        />
        <Button size="sm" className="h-8 shrink-0" disabled={pending || !code.trim()} onClick={() => void handleApply()}>
          {pending ? "…" : "Apply"}
        </Button>
      </div>
      {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
      <button
        type="button"
        onClick={handleSkip}
        className="mt-2 text-[11px] text-muted-foreground underline-offset-2 hover:underline"
      >
        Skip for now
      </button>
    </div>
  )
}
