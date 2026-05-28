import { Contract, TransactionBuilder, rpc, xdr, scValToNative } from "@stellar/stellar-sdk"
import { NETWORK } from "@/app/config/network"
import { sorobanRpc } from "@/lib/soroban/client"
import type { Transaction } from "@stellar/stellar-sdk"

function i128(v: bigint): xdr.ScVal {
  return xdr.ScVal.scvI128(
    new xdr.Int128Parts({
      lo: xdr.Uint64.fromString((v & BigInt("0xFFFFFFFFFFFFFFFF")).toString()),
      hi: xdr.Int64.fromString((v >> BigInt(64)).toString()),
    }),
  )
}

function address(a: string): xdr.ScVal {
  return xdr.ScVal.scvString(a)
}

export async function checkAllowance(
  tokenAddress: string,
  owner: string,
  spender: string,
): Promise<bigint> {
  const contract = new Contract(tokenAddress)
  const source = await sorobanRpc.getAccount(owner)
  const tx = new TransactionBuilder(source, {
    fee: "100",
    networkPassphrase: NETWORK.networkPassphrase,
  })
    .addOperation(contract.call("allowance", address(owner), address(spender)))
    .setTimeout(180)
    .build()

  const simulation = await sorobanRpc.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Allowance check failed: ${simulation.error}`)
  }

  if (rpc.Api.isSimulationSuccess(simulation) && simulation.result) {
    const native = scValToNative(simulation.result.retval)
    if (typeof native === "bigint") return native
    if (typeof native === "number") return BigInt(native)
  }

  return BigInt(0)
}

export async function buildApproveTransaction(
  tokenAddress: string,
  owner: string,
  spender: string,
  amount: bigint,
): Promise<Transaction> {
  const contract = new Contract(tokenAddress)
  const source = await sorobanRpc.getAccount(owner)
  let tx = new TransactionBuilder(source, {
    fee: "100",
    networkPassphrase: NETWORK.networkPassphrase,
  })
    .addOperation(contract.call("approve", address(owner), address(spender), i128(amount), xdr.ScVal.scvU32(4294967295)))
    .setTimeout(180)
    .build()

  const simulation = await sorobanRpc.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Approve simulation failed: ${simulation.error}`)
  }

  return rpc.assembleTransaction(tx, simulation).build()
}
