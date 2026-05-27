import {
  Contract,
  Account,
  TransactionBuilder,
  rpc,
  scValToNative,
  Address,
  nativeToScVal,
} from "@stellar/stellar-sdk"
import { sorobanRpc } from "./client"
import { NETWORK } from "../../app/config/network"
import { CONTRACTS } from "../../app/config/contracts"

const DUMMY_ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"

export type VestingSchedule = {
  locked: bigint
  unlocked: bigint
  claimable: bigint
}

/**
 * Build a transaction to deposit esSO4 for vesting.
 *
 * @param account - The user's account address.
 * @param amount - The amount of esSO4 to vest.
 * @returns Base64 XDR string of the built, fee-assembled transaction.
 */
export async function depositForVesting(account: string, amount: number | bigint): Promise<string> {
  const sourceAccount = await sorobanRpc.getAccount(account)
  const contract = new Contract(CONTRACTS.vestingRouter)

  const accountVal = new Address(account).toScVal()
  const amountVal = nativeToScVal(BigInt(amount), { type: "i128" })

  let tx = new TransactionBuilder(sourceAccount, {
    fee: "100",
    networkPassphrase: NETWORK.networkPassphrase,
  })
    .addOperation(contract.call("deposit_for_vesting", accountVal, amountVal))
    .setTimeout(180)
    .build()

  const simulation = await sorobanRpc.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Transaction simulation failed: ${simulation.error}`)
  }

  tx = rpc.assembleTransaction(tx, simulation).build()
  return tx.toXDR()
}

/**
 * Build a transaction to claim unlocked vested tokens.
 *
 * @param account - The user's account address.
 * @returns Base64 XDR string of the built, fee-assembled transaction.
 */
export async function claim(account: string): Promise<string> {
  const sourceAccount = await sorobanRpc.getAccount(account)
  const contract = new Contract(CONTRACTS.vestingRouter)

  const accountVal = new Address(account).toScVal()

  let tx = new TransactionBuilder(sourceAccount, {
    fee: "100",
    networkPassphrase: NETWORK.networkPassphrase,
  })
    .addOperation(contract.call("claim", accountVal))
    .setTimeout(180)
    .build()

  const simulation = await sorobanRpc.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Transaction simulation failed: ${simulation.error}`)
  }

  tx = rpc.assembleTransaction(tx, simulation).build()
  return tx.toXDR()
}

/**
 * Query the vesting schedule for an account (read-only simulation).
 *
 * @param account - The user's account address.
 * @returns The vesting schedule containing locked, unlocked, and claimable balances.
 */
export async function getVestingSchedule(account: string): Promise<VestingSchedule> {
  const contract = new Contract(CONTRACTS.vestingRouter)
  const dummyAccount = new Account(DUMMY_ACCOUNT, "0")
  const accountVal = new Address(account).toScVal()

  const tx = new TransactionBuilder(dummyAccount, {
    fee: "100",
    networkPassphrase: NETWORK.networkPassphrase,
  })
    .addOperation(contract.call("get_vesting_schedule", accountVal))
    .setTimeout(30)
    .build()

  const simulation = await sorobanRpc.simulateTransaction(tx)

  if (rpc.Api.isSimulationSuccess(simulation)) {
    const retval = simulation.result?.retval
    if (retval) {
      const native = scValToNative(retval)
      if (native && typeof native === "object") {
        return {
          locked: BigInt(native.locked ?? 0n),
          unlocked: BigInt(native.unlocked ?? 0n),
          claimable: BigInt(native.claimable ?? 0n),
        }
      }
    }
  }

  throw new Error(`Failed to query getVestingSchedule for account ${account}`)
}
