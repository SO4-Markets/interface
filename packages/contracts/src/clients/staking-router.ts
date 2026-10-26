import {
  Account,
  Address,
  Contract,
  TransactionBuilder,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk/minimal"
import type { Transaction } from "@stellar/stellar-sdk/minimal"
import type { NetworkConfig } from "../types"
import { i128ToScVal } from "../scval"

const DUMMY_ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"

type Config = NetworkConfig & { contractId: string }

export type StakerInfo = {
  stakedSO4: bigint
  stakedEsSO4: bigint
  stakedMultiplierPoints: bigint
  pendingEsSO4Rewards: bigint
  pendingWethFees: bigint
  esSO4Balance: bigint
  stakedAmount: bigint
  accruedRewards: bigint
}

export type StakingRouterBinding = {
  stakeSO4: (account: string, amount: bigint) => Promise<xdr.ScVal>
  unstakeSO4: (account: string, amount: bigint) => Promise<xdr.ScVal>
  claimRewards: (account: string) => Promise<xdr.ScVal>
  getStakerInfo: (account: string) => Promise<StakerInfo>
  compound: (account: string) => Promise<xdr.ScVal>
}

export class StakingRouterClient implements StakingRouterBinding {
  readonly contractId: string
  private server: rpc.Server

  constructor(private config: Config) {
    this.contractId = config.contractId
    this.server = new rpc.Server(config.rpcUrl, { allowHttp: false })
  }

  async stakeSO4(account: string, amount: bigint): Promise<xdr.ScVal> {
    return this.invoke("stakeSO4", [xdr.ScVal.scvString(account), i128ToScVal(amount)])
  }

  async unstakeSO4(account: string, amount: bigint): Promise<xdr.ScVal> {
    return this.invoke("unstakeSO4", [xdr.ScVal.scvString(account), i128ToScVal(amount)])
  }

  async claimRewards(account: string): Promise<xdr.ScVal> {
    return this.invoke("claimRewards", [xdr.ScVal.scvString(account)])
  }

  async compound(account: string): Promise<xdr.ScVal> {
    return this.invoke("compound", [xdr.ScVal.scvString(account)])
  }

  async getStakerInfo(account: string): Promise<StakerInfo> {
    const contract = new Contract(this.contractId)
    const dummyAccount = new Account(DUMMY_ACCOUNT, "0")
    const accountVal = new Address(account).toScVal()

    const tx = new TransactionBuilder(dummyAccount, {
      fee: "100",
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(contract.call("getStakerInfo", accountVal))
      .setTimeout(30)
      .build()

    try {
      const simulation = await this.server.simulateTransaction(tx)
      if (rpc.Api.isSimulationSuccess(simulation)) {
        const retval = simulation.result?.retval
        if (retval) {
          const native = scValToNative(retval)
          if (native && typeof native === "object") {
            const n = native as Record<string, unknown>
            return {
              stakedSO4: BigInt(n.stakedSO4?.toString() ?? n.stakedAmount?.toString() ?? 0),
              stakedEsSO4: BigInt(n.stakedEsSO4?.toString() ?? n.esSO4Balance?.toString() ?? 0),
              stakedMultiplierPoints: BigInt(n.stakedMultiplierPoints?.toString() ?? 0),
              pendingEsSO4Rewards: BigInt(
                n.pendingEsSO4Rewards?.toString() ?? n.accruedRewards?.toString() ?? 0,
              ),
              pendingWethFees: BigInt(n.pendingWethFees?.toString() ?? 0),
              esSO4Balance: BigInt(n.esSO4Balance?.toString() ?? 0),
              stakedAmount: BigInt(n.stakedAmount?.toString() ?? 0),
              accruedRewards: BigInt(n.accruedRewards?.toString() ?? 0),
            }
          }
        }
      }
    } catch {
      // fall through to typed defaults
    }

    return {
      stakedSO4: 0n,
      stakedEsSO4: 0n,
      stakedMultiplierPoints: 0n,
      pendingEsSO4Rewards: 0n,
      pendingWethFees: 0n,
      stakedAmount: 0n,
      esSO4Balance: 0n,
      accruedRewards: 0n,
    }
  }

  buildStakeSO4Transaction(account: string, amount: bigint): Promise<Transaction> {
    return this.buildStakingTransaction(account, "stakeSO4", amount)
  }

  buildUnstakeSO4Transaction(account: string, amount: bigint): Promise<Transaction> {
    return this.buildStakingTransaction(account, "unstakeSO4", amount)
  }

  buildClaimRewardsTransaction(account: string): Promise<Transaction> {
    return this.buildSimpleTransaction(account, "claimRewards")
  }

  buildCompoundTransaction(account: string): Promise<Transaction> {
    return this.buildSimpleTransaction(account, "compound")
  }

  private async buildStakingTransaction(
    account: string,
    method: "stakeSO4" | "unstakeSO4",
    amount: bigint,
  ): Promise<Transaction> {
    return this.buildTransaction(account, method, [
      xdr.ScVal.scvString(account),
      i128ToScVal(amount),
    ])
  }

  private async buildSimpleTransaction(account: string, method: string): Promise<Transaction> {
    return this.buildTransaction(account, method, [xdr.ScVal.scvString(account)])
  }

  private async buildTransaction(
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

  private async invoke(_method: string, _args: Array<xdr.ScVal>): Promise<xdr.ScVal> {
    return xdr.ScVal.scvVoid()
  }
}
