import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { validateReferralCode } from "../lib/referrals"
import { useCreateReferralCodeMutation } from "../hooks/useCreateReferralCodeMutation"

export type CreateReferralDialogProps = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateReferralDialog({
  isOpen,
  onOpenChange,
}: CreateReferralDialogProps) {
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const mutation = useCreateReferralCodeMutation()

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCode = e.target.value
    setCode(newCode)
    if (newCode.length > 0) {
      setError(validateReferralCode(newCode))
    } else {
      setError(null)
    }
  }

  const handleSubmit = async () => {
    const validationError = validateReferralCode(code)
    if (validationError) {
      setError(validationError)
      return
    }

    try {
      await mutation.mutateAsync(code)
      onOpenChange(false)
      setCode("")
      setError(null)
    } catch (err) {
      // Error handled by submitTx
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Referral Code</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <label className="mb-2 block text-sm font-medium">Referral Code</label>
            <Input
              placeholder="e.g. MY_CUSTOM_CODE"
              value={code}
              onChange={handleCodeChange}
              className={error ? "border-red-500" : ""}
            />
            {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
            {!error && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Minimum 3 characters. Only letters, numbers, and underscores allowed.
              </p>
            )}
          </div>

          <Button
            className="w-full"
            disabled={mutation.isPending || !!error || code.length === 0}
            onClick={() => void handleSubmit()}
          >
            {mutation.isPending ? "Creating..." : "Create Code"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
