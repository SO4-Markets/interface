import { xdr } from "@stellar/stellar-sdk"
import { i128ToScVal } from "../scval"

export type OrderVaultBinding = {
  transferOut: (account: string, token: string, amount: bigint) => Promise<xdr.ScVal>
  recordTransferIn: (account: string, token: string, amount: bigint) => Promise<xdr.ScVal>
}

export class OrderVaultClient implements OrderVaultBinding {
  readonly contractId: string

  constructor(contractId: string) {
    this.contractId = contractId
  }

  async transferOut(account: string, token: string, amount: bigint): Promise<xdr.ScVal> {
    return this.invoke("transferOut", [
      xdr.ScVal.scvString(account),
      xdr.ScVal.scvString(token),
      i128ToScVal(amount),
    ])
  }

  async recordTransferIn(account: string, token: string, amount: bigint): Promise<xdr.ScVal> {
    return this.invoke("recordTransferIn", [
      xdr.ScVal.scvString(account),
      xdr.ScVal.scvString(token),
      i128ToScVal(amount),
    ])
  }

  private async invoke(method: string, _args: Array<xdr.ScVal>): Promise<xdr.ScVal> {
    // OB-089: The OrderVault stub must never produce a successful deposit or
    // withdrawal response. Collateral transfers require an executable path through
    // ExchangeRouter with simulation, signature, and confirmation evidence.
    throw new Error(
      `OrderVault.${method} cannot be invoked directly. Direct OrderVault transfers are not supported; collateral transfers must be routed through ExchangeRouter with verified simulation and confirmation evidence.`,
    )
  }
}
