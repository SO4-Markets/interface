import {
  Account,
  Address,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk/minimal"
import type { Transaction } from "@stellar/stellar-sdk/minimal"
import type { NetworkConfig } from "../types"

const DUMMY_ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"

type Config = NetworkConfig & { contractId: string }

export type VestingSchedule = {
  deposited: bigint
  vested: bigint
  claimable: bigint
  vestingEndTimestamp: number
}

export type LegacyVestingSchedule = {
  locked: bigint
  unlocked: bigint
  claimable: bigint
}

export type VestingRouterBinding = {
  getVestingSchedule: (account: string) => Promise<VestingSchedule>
}

export class VestingRouterClient implements VestingRouterBinding {
  readonly contractId: string
  private server: rpc.Server

  constructor(private config: Config) {
    this.contractId = config.contractId
    this.server = new rpc.Server(config.rpcUrl, { allowHttp: false })
  }

  async getVestingSchedule(account: string): Promise<VestingSchedule> {
    const contract = new Contract(this.contractId)
    const dummyAccount = new Account(DUMMY_ACCOUNT, "0")
    const accountVal = new Address(account).toScVal()

    const tx = new TransactionBuilder(dummyAccount, {
      fee: "100",
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(contract.call("get_vesting_schedule", accountVal))
      .setTimeout(30)
      .build()

    try {
      const simulation = await this.server.simulateTransaction(tx)
      if (rpc.Api.isSimulationSuccess(simulation)) {
        const retval = simulation.result?.retval
        if (retval) {
          const native = scValToNative(retval)
          if (native && typeof native === "object") {
            return decodeSchedule(native as Record<string, unknown>)
          }
        }
      }
    } catch {
      // fall through to typed defaults
    }

    return { deposited: 0n, vested: 0n, claimable: 0n, vestingEndTimestamp: 0 }
  }

  async getLegacyVestingSchedule(account: string): Promise<LegacyVestingSchedule> {
    const schedule = await this.getVestingSchedule(account)
    return {
      locked: schedule.deposited,
      unlocked: schedule.vested,
      claimable: schedule.claimable,
    }
  }

  buildDepositForVestingTransaction(account: string, amount: bigint): Promise<Transaction> {
    return this.buildAccountTransaction(account, "deposit_for_vesting", [
      new Address(account).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
    ])
  }

  async depositForVesting(account: string, amount: number | bigint): Promise<string> {
    const tx = await this.buildDepositForVestingTransaction(account, BigInt(amount))
    return tx.toXDR()
  }

  async claim(account: string): Promise<string> {
    const tx = await this.buildAccountTransaction(account, "claim", [
      new Address(account).toScVal(),
    ])
    return tx.toXDR()
  }

  private async buildAccountTransaction(
    account: string,
    method: string,
    args: Array<xdr.ScVal>,
  ): Promise<Transaction> {
    const sourceAccount = await this.server.getAccount(account)
    const contract = new Contract(this.contractId)

    const tx = new TransactionBuilder(sourceAccount, {
      fee: "100",
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(180)
      .build()

    const simulation = await this.server.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(simulation)) {
      throw new Error(`Transaction simulation failed: ${simulation.error}`)
    }

    return rpc.assembleTransaction(tx, simulation).build()
  }
}

function decodeSchedule(native: Record<string, unknown>): VestingSchedule {
  return {
    deposited: BigInt(native.locked?.toString() ?? native.deposited?.toString() ?? 0),
    vested: BigInt(native.unlocked?.toString() ?? native.vested?.toString() ?? 0),
    claimable: BigInt(native.claimable?.toString() ?? 0),
    vestingEndTimestamp: Number(native.end ?? native.vestingEndTimestamp ?? 0),
  }
}
