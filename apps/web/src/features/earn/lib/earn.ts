import { toast } from "sonner"
import { submitTx } from "@/shared/hooks/useTxSubmit"

function fakeTxDelay(ms = 1500): Promise<void> {
  return new Promise((res) => setTimeout(res, ms))
}

async function runMockWrite(loadingMessage: string, successMessage: string, delay = 1500): Promise<string> {
  return submitTx(async () => "", {
    loadingMessage,
    successMessage,
    successDescription: () => "Tx: DUMMY_TX_HASH",
    execute: async () => {
      await fakeTxDelay(delay)
      return "DUMMY_TX_HASH"
    },
    onError: (error) => (error instanceof Error ? error.message : "Transaction failed"),
  })
}

export async function stakeSO4(_account: string, _amountSO4: number): Promise<string> {
  return runMockWrite("Staking SO4...", "SO4 staked successfully")
}

export async function unstakeSO4(_account: string, _amountSO4: number): Promise<string> {
  return runMockWrite("Unstaking SO4...", "SO4 unstaked successfully")
}

export async function depositGM(_account: string, poolName: string, _amountUsd: number): Promise<string> {
  return runMockWrite(`Depositing into ${poolName}...`, "GM deposit submitted")
}

export async function withdrawGM(_account: string, poolName: string, _gmAmount: number): Promise<string> {
  return runMockWrite(`Withdrawing from ${poolName}...`, "GM withdrawal submitted")
}

export async function depositGLV(_account: string, vaultName: string, _amountUsd: number): Promise<string> {
  return runMockWrite(`Depositing into ${vaultName}...`, "GLV deposit submitted")
}

export async function withdrawGLV(_account: string, vaultName: string, _glvAmount: number): Promise<string> {
  return runMockWrite(`Withdrawing from ${vaultName}...`, "GLV withdrawal submitted")
}

export async function claimRewards(_account: string): Promise<string> {
  return runMockWrite("Claiming rewards...", "Rewards claimed", 1000)
}

export async function compoundRewards(_account: string): Promise<string> {
  return runMockWrite("Compounding rewards...", "Rewards compounded", 1200)
}

export async function vestEsSO4(_account: string, _amount: number): Promise<string> {
  return runMockWrite("Starting esSO4 vesting...", "Vesting started")
}

export function buySO4(): void {
  toast.info("SO4 purchase coming soon", { description: "DEX integration in progress" })
}
