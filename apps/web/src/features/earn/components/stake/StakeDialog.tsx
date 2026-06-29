import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { useStakeMutation } from "../../hooks/useStakeMutation"

export type StakeDialogProps = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  initialAction?: "stake" | "unstake"
}

export function StakeDialog({
  isOpen,
  onOpenChange,
  initialAction = "stake",
}: StakeDialogProps) {
  const [action, setAction] = useState<"stake" | "unstake">(initialAction)
  const [amount, setAmount] = useState("")
  const [multiplier, setMultiplier] = useState(1)
  const mutation = useStakeMutation()

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) return

    try {
      await mutation.mutateAsync({
        action,
        amount: parsedAmount,
        durationMultiplier: multiplier,
      })
      onOpenChange(false)
      setAmount("")
      setMultiplier(1)
    } catch (err) {
      // errors handled by submitTx or mutation onError
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{action === "stake" ? "Stake SO4" : "Unstake SO4"}</DialogTitle>
        </DialogHeader>

        <div className="mb-4 flex gap-2">
          <Button
            variant={action === "stake" ? "default" : "outline"}
            onClick={() => setAction("stake")}
            className="w-full"
          >
            Stake
          </Button>
          <Button
            variant={action === "unstake" ? "default" : "outline"}
            onClick={() => setAction("unstake")}
            className="w-full"
          >
            Unstake
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Amount</label>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {action === "stake" && (
            <div>
              <label className="mb-2 block text-sm font-medium">Duration Multiplier</label>
              <div className="flex gap-2">
                {[1, 1.5, 2].map((m) => (
                  <Button
                    key={m}
                    variant={multiplier === m ? "default" : "outline"}
                    onClick={() => setMultiplier(m)}
                    className="flex-1"
                  >
                    {m}x
                  </Button>
                ))}
              </div>
            </div>
          )}

          <Button
            className="w-full"
            disabled={mutation.isPending || !amount || parseFloat(amount) <= 0}
            onClick={() => void handleSubmit()}
          >
            {mutation.isPending
              ? "Confirming..."
              : action === "stake"
                ? "Stake SO4"
                : "Unstake SO4"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
