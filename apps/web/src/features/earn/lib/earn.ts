import { toast } from "sonner"
import { GLV_VAULTS, GM_POOLS } from "../data/pools"
import { submitTx } from "@/shared/hooks/useTxSubmit"
import { NETWORK } from "@/app/config/network"
import { queryClient } from "@/app/providers/QueryProvider"
import { prepareAndSign } from "@/lib/soroban/tx-builder"
import {
  buildClaimRewardsTransaction,
  buildCompoundTransaction,
  buildCreateDepositTransaction,
  buildCreateWithdrawalTransaction,
  buildDepositForVestingTransaction,
  buildStakeSO4Transaction,
  buildUnstakeSO4Transaction,
  parseSorobanError,
} from "@/lib/contracts"
import { walletKit } from "@/features/wallet/lib/wallet-kit"
import { queryKeys } from "@/shared/lib/query-keys"
import { toSorobanAmount } from "@/shared/lib/bignum"
import {
  createDeposit as createGlvDeposit,
  createWithdrawal as createGlvWithdrawal,
} from "@/lib/glv-router-client"

const SO4_DECIMALS = 7
const GM_TOKEN_DECIMALS = 7
const GLV_TOKEN_DECIMALS = 7

function isValidAccount(account: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(account)
}

async function invalidateStakingQueries(account: string): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.earn.stakingInfo(account) }),
    queryClient.invalidateQueries({ queryKey: ["tokenBalances", account] }),
  ])
}

export async function stakeSO4(account: string, amountSO4: number): Promise<string> {
  if (!isValidAccount(account)) throw new Error("Connect your wallet before staking.")
  if (!(amountSO4 > 0)) throw new Error("Enter an amount of SO4 to stake.")

  const amount = toSorobanAmount(amountSO4, SO4_DECIMALS)

  return submitTx(
    async () => {
      const tx = await buildStakeSO4Transaction(account, amount)
      return prepareAndSign(tx, walletKit, NETWORK.networkPassphrase)
    },
    {
      loadingMessage: `Staking ${amountSO4} SO4...`,
      successMessage: "SO4 staked successfully",
      successDescription: (hash) => `Tx: ${hash.slice(0, 8)}...`,
      onSuccess: () => invalidateStakingQueries(account),
      onError: parseSorobanError,
    },
  )
}

export async function unstakeSO4(account: string, amountSO4: number): Promise<string> {
  if (!isValidAccount(account)) throw new Error("Connect your wallet before unstaking.")
  if (!(amountSO4 > 0)) throw new Error("Enter an amount of SO4 to unstake.")

  const amount = toSorobanAmount(amountSO4, SO4_DECIMALS)

  return submitTx(
    async () => {
      const tx = await buildUnstakeSO4Transaction(account, amount)
      return prepareAndSign(tx, walletKit, NETWORK.networkPassphrase)
    },
    {
      loadingMessage: `Unstaking ${amountSO4} SO4...`,
      successMessage: "SO4 unstaked successfully",
      successDescription: (hash) =>
        `Tokens may be subject to an unbonding period before withdrawal. Tx: ${hash.slice(0, 8)}...`,
      onSuccess: () => invalidateStakingQueries(account),
      onError: parseSorobanError,
    },
  )
}

export async function depositGM(account: string, poolName: string, amountUsd: number): Promise<string> {
  if (!isValidAccount(account)) throw new Error("Connect your wallet before depositing.")
  if (!(amountUsd > 0)) throw new Error("Enter an amount to deposit.")

  const pool = GM_POOLS.find(
    (p) => p.name === poolName || p.id === poolName || p.marketAddress === poolName,
  )
  if (!pool) throw new Error(`Unknown GM pool: ${poolName}`)

  // Deposit the full amount as the long token; short side is left to rebalancing.
  const longTokenAmount = toSorobanAmount(amountUsd, GM_TOKEN_DECIMALS)

  let expectedGm: bigint | null = null

  return submitTx(
    async () => {
      const built = await buildCreateDepositTransaction({
        caller: account,
        market: pool.marketAddress,
        longTokenAmount,
        shortTokenAmount: 0n,
      })
      expectedGm = built.expectedGm
      return prepareAndSign(built.tx, walletKit, NETWORK.networkPassphrase)
    },
    {
      loadingMessage: `Depositing into ${pool.name}...`,
      successMessage: "GM deposit submitted",
      successDescription: (hash) =>
        expectedGm !== null
          ? `~${expectedGm.toString()} GM expected | Tx: ${hash.slice(0, 8)}...`
          : `Tx: ${hash.slice(0, 8)}...`,
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: queryKeys.earn.gmPoolData(pool.marketAddress, account) }),
      onError: parseSorobanError,
    },
  )
}

export async function withdrawGM(account: string, poolName: string, gmAmount: number): Promise<string> {
  if (!isValidAccount(account)) throw new Error("Connect your wallet before withdrawing.")
  if (!(gmAmount > 0)) throw new Error("Enter an amount of GM to withdraw.")

  const pool = GM_POOLS.find(
    (p) => p.name === poolName || p.id === poolName || p.marketAddress === poolName,
  )
  if (!pool) throw new Error(`Unknown GM pool: ${poolName}`)

  const withdrawalAmount = toSorobanAmount(gmAmount, GM_TOKEN_DECIMALS)
  let expectedLongTokens: bigint | null = null
  let expectedShortTokens: bigint | null = null

  return submitTx(
    async () => {
      const built = await buildCreateWithdrawalTransaction({
        caller: account,
        market: pool.marketAddress,
        marketTokenAmount: withdrawalAmount,
      })
      expectedLongTokens = built.expectedLongTokens
      expectedShortTokens = built.expectedShortTokens
      return prepareAndSign(built.tx, walletKit, NETWORK.networkPassphrase)
    },
    {
      loadingMessage: `Withdrawing from ${pool.name}...`,
      successMessage: "GM withdrawal submitted",
      successDescription: (hash) =>
        expectedLongTokens !== null && expectedShortTokens !== null
          ? `~${expectedLongTokens.toString()} long + ~${expectedShortTokens.toString()} short expected | Tx: ${hash.slice(0, 8)}...`
          : `Tx: ${hash.slice(0, 8)}...`,
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: queryKeys.earn.gmPoolData(pool.marketAddress, account) }),
      onError: parseSorobanError,
    },
  )
}

export async function depositGLV(account: string, vaultName: string, amountUsd: number): Promise<string> {
  if (!isValidAccount(account)) throw new Error("Connect your wallet before depositing.")
  if (!(amountUsd > 0)) throw new Error("Enter an amount to deposit.")

  const vault = GLV_VAULTS.find(
    (entry) =>
      entry.id === vaultName ||
      entry.name === vaultName ||
      `${entry.name} [${entry.displayPair}]` === vaultName,
  )
  if (!vault) throw new Error(`Unknown GLV vault: ${vaultName}`)

  const depositAmount = toSorobanAmount(amountUsd, GLV_TOKEN_DECIMALS)
  return createGlvDeposit({
    account,
    glvAddress: vault.id,
    depositAmount,
  })
}

export async function withdrawGLV(account: string, vaultName: string, glvAmount: number): Promise<string> {
  if (!isValidAccount(account)) throw new Error("Connect your wallet before withdrawing.")
  if (!(glvAmount > 0)) throw new Error("Enter an amount of GLV to withdraw.")

  const vault = GLV_VAULTS.find(
    (entry) =>
      entry.id === vaultName ||
      entry.name === vaultName ||
      `${entry.name} [${entry.displayPair}]` === vaultName,
  )
  if (!vault) throw new Error(`Unknown GLV vault: ${vaultName}`)

  const withdrawalAmount = toSorobanAmount(glvAmount, GLV_TOKEN_DECIMALS)
  return createGlvWithdrawal({
    account,
    glvAddress: vault.id,
    withdrawalAmount,
  })
}

export async function claimRewards(account: string): Promise<string> {
  if (!isValidAccount(account)) throw new Error("Connect your wallet before claiming rewards.")

  return submitTx(
    async () => {
      const tx = await buildClaimRewardsTransaction(account)
      return prepareAndSign(tx, walletKit, NETWORK.networkPassphrase)
    },
    {
      loadingMessage: "Claiming rewards...",
      successMessage: "Rewards claimed successfully",
      successDescription: (hash) => `Tx: ${hash.slice(0, 8)}...`,
      onSuccess: () => invalidateStakingQueries(account),
      onError: parseSorobanError,
    },
  )
}

export async function compoundRewards(account: string): Promise<string> {
  if (!isValidAccount(account)) throw new Error("Connect your wallet before compounding rewards.")

  return submitTx(
    async () => {
      const tx = await buildCompoundTransaction(account)
      return prepareAndSign(tx, walletKit, NETWORK.networkPassphrase)
    },
    {
      loadingMessage: "Compounding rewards...",
      successMessage: "Rewards compounded successfully",
      successDescription: (hash) => `Tx: ${hash.slice(0, 8)}...`,
      onSuccess: () => invalidateStakingQueries(account),
      onError: parseSorobanError,
    },
  )
}

export async function vestEsSO4(account: string, amount: number): Promise<string> {
  if (!isValidAccount(account)) throw new Error("Connect your wallet before vesting.")
  if (!(amount > 0)) throw new Error("Enter an amount of esSO4 to vest.")

  const vestAmount = toSorobanAmount(amount, SO4_DECIMALS)

  return submitTx(
    async () => {
      const tx = await buildDepositForVestingTransaction(account, vestAmount)
      return prepareAndSign(tx, walletKit, NETWORK.networkPassphrase)
    },
    {
      loadingMessage: `Starting vesting for ${amount} esSO4...`,
      successMessage: "Vesting started successfully",
      successDescription: (hash) => `Tx: ${hash.slice(0, 8)}...`,
      onSuccess: () => invalidateStakingQueries(account),
      onError: parseSorobanError,
    },
  )
}

export function buySO4(): void {
  toast.info("SO4 purchase coming soon", { description: "DEX integration in progress" })
}
