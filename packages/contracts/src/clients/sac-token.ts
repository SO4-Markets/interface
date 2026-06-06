import { Address, Contract, TransactionBuilder, rpc, scValToNative, xdr } from "@stellar/stellar-sdk"
import type { Transaction } from "@stellar/stellar-sdk"
import type { NetworkConfig } from "../types"
import { i128ToScVal } from "../scval"

type Config = NetworkConfig

const DEFAULT_ALLOWANCE_LEDGERS = 120_960

function address(value: string): xdr.ScVal {
  return new Address(value).toScVal()
}

export class SacTokenClient {
  private server: rpc.Server

  constructor(private config: Config) {
    this.server = new rpc.Server(config.rpcUrl, { allowHttp: false })
  }

  async checkAllowance(tokenAddress: string, owner: string, spender: string): Promise<bigint> {
    const contract = new Contract(tokenAddress)
    const source = await this.server.getAccount(owner)
    const tx = new TransactionBuilder(source, {
      fee: "100",
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(contract.call("allowance", address(owner), address(spender)))
      .setTimeout(180)
      .build()

    const simulation = await this.server.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(simulation)) {
      throw new Error(`Allowance check failed: ${simulation.error}`)
    }

    if (rpc.Api.isSimulationSuccess(simulation) && simulation.result) {
      const native = scValToNative(simulation.result.retval)
      if (typeof native === "bigint") return native
      if (typeof native === "number") return BigInt(native)
    }

    return 0n
  }

  async buildApproveTransaction(
    tokenAddress: string,
    owner: string,
    spender: string,
    amount: bigint,
    expirationLedger?: number,
  ): Promise<Transaction> {
    const contract = new Contract(tokenAddress)
    const source = await this.server.getAccount(owner)
    const latestLedger = await this.server.getLatestLedger()
    const liveUntilLedger = expirationLedger ?? latestLedger.sequence + DEFAULT_ALLOWANCE_LEDGERS
    const tx = new TransactionBuilder(source, {
      fee: "100",
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(
        contract.call(
          "approve",
          address(owner),
          address(spender),
          i128ToScVal(amount),
          xdr.ScVal.scvU32(liveUntilLedger),
        ),
      )
      .setTimeout(180)
      .build()

    const simulation = await this.server.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(simulation)) {
      throw new Error(`Approve simulation failed: ${simulation.error}`)
    }

    return rpc.assembleTransaction(tx, simulation).build()
  }
}
