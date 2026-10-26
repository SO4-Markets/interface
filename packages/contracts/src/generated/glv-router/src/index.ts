import { Account, Address, Contract, TransactionBuilder, rpc, xdr } from "@stellar/stellar-sdk/minimal"

const DUMMY_ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"

export interface CreateDepositParams {
  account: string
  glvAddress: string
  depositAmount: bigint
}

export interface CreateWithdrawalParams {
  account: string
  glvAddress: string
  withdrawalAmount: bigint
}

export interface GlvInfo {
  glvAddress: string
  totalDeposits: bigint
  totalShares: bigint
  sharePrice: bigint
  lastUpdatedAt: bigint
}

export interface ClientOptions {
  contractId: string
  networkPassphrase: string
  rpcUrl: string
}

function i128(v: bigint): xdr.ScVal {
  return xdr.ScVal.scvI128(
    new xdr.Int128Parts({
      lo: xdr.Uint64.fromString((v & BigInt("0xFFFFFFFFFFFFFFFF")).toString()),
      hi: xdr.Int64.fromString((v >> BigInt(64)).toString()),
    }),
  )
}

function address(a: string): xdr.ScVal {
  return new Address(a).toScVal()
}

export class Client {
  private contract: Contract
  private rpcUrl: string
  private networkPassphrase: string

  constructor(opts: ClientOptions) {
    this.contract = new Contract(opts.contractId)
    this.rpcUrl = opts.rpcUrl
    this.networkPassphrase = opts.networkPassphrase
  }

  private async buildTx(method: string, ...args: xdr.ScVal[]): Promise<string> {
    const server = new rpc.Server(this.rpcUrl)
    const sourceAccount = await server.getAccount(addressToString(args[0]))
    const tx = new TransactionBuilder(sourceAccount, {
      fee: "100",
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(this.contract.call(method, ...args))
      .setTimeout(180)
      .build()

    const simulation = await server.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(simulation)) {
      throw new Error(`Simulation error: ${simulation.error}`)
    }

    return rpc.assembleTransaction(tx, simulation).build().toXDR()
  }

  private async simulateTx(method: string, ...args: xdr.ScVal[]): Promise<xdr.ScVal> {
    const server = new rpc.Server(this.rpcUrl)
    const dummyAccount = new Account(DUMMY_ACCOUNT, "0")
    const tx = new TransactionBuilder(dummyAccount, {
      fee: "100",
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(this.contract.call(method, ...args))
      .setTimeout(30)
      .build()

    const sim = await server.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`Simulation error: ${sim.error}`)
    }

    return (sim as rpc.Api.SimulateTransactionSuccessResponse).result?.retval as xdr.ScVal
  }

  private fieldVal(m: xdr.ScMapEntry[], name: string): xdr.ScVal | undefined {
    return m.find((e) => e.key().sym() === name)?.val()
  }

  private i128Val(v: xdr.ScVal | undefined): bigint {
    if (!v) return 0n
    const parts = v.i128()
    return parts ? BigInt(parts.lo().toString()) : 0n
  }

  private addressVal(v: xdr.ScVal | undefined, fallback: string): string {
    if (!v) return fallback
    try {
      return Address.fromScVal(v).toString()
    } catch {
      return fallback
    }
  }

  async createDeposit(params: CreateDepositParams): Promise<string> {
    return this.buildTx(
      "createDeposit",
      address(params.account),
      address(params.glvAddress),
      i128(params.depositAmount),
    )
  }

  async createWithdrawal(params: CreateWithdrawalParams): Promise<string> {
    return this.buildTx(
      "createWithdrawal",
      address(params.account),
      address(params.glvAddress),
      i128(params.withdrawalAmount),
    )
  }

  async getGlvInfo(glvAddress: string): Promise<GlvInfo> {
    const ret = await this.simulateTx("getGlvInfo", address(glvAddress))
    const m = ret.map() ?? []
    return {
      glvAddress: this.addressVal(this.fieldVal(m, "glv_address"), glvAddress),
      totalDeposits: this.i128Val(this.fieldVal(m, "total_deposits")),
      totalShares: this.i128Val(this.fieldVal(m, "total_shares")),
      sharePrice: this.i128Val(this.fieldVal(m, "share_price")),
      lastUpdatedAt: this.i128Val(this.fieldVal(m, "last_updated_at")),
    }
  }
}

function addressToString(value: xdr.ScVal): string {
  return Address.fromScVal(value).toString()
}
