import {
  Address,
  Keypair,
  Operation,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk"
import { sorobanRpc } from "@/lib/soroban/client"
import { NETWORK } from "@/app/config/network"
import { CONTRACTS } from "@/app/config/contracts"

const SIM_SOURCE = Keypair.random().publicKey()

export type FeeConfig = {
  positionFeeBps: number
  swapFeeBps: number
  borrowingRatePerHour: number
  minExecutionFeeXlm: number
}

const DEFAULT_FEE_CONFIG: FeeConfig = {
  positionFeeBps: 10,
  swapFeeBps: 10,
  borrowingRatePerHour: 0.0001,
  minExecutionFeeXlm: 0.3,
}

function hexFromUtf8(str: string): string {
  return Array.from(new TextEncoder().encode(str))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function toNumber(val: unknown): number {
  if (typeof val === "number") return val
  if (typeof val === "bigint") return Number(val)
  return 0
}

function positionFeeFactorKey(marketAddress: string, isIncrease: boolean): string {
  return hexFromUtf8(`POSITION_FEE_FACTOR:${marketAddress}:${isIncrease ? "1" : "0"}`)
}

function swapFeeFactorKey(marketAddress: string): string {
  return hexFromUtf8(`SWAP_FEE_FACTOR:${marketAddress}`)
}

function borrowingRateFactorKey(marketAddress: string, isLong: boolean): string {
  return hexFromUtf8(`BORROWING_RATE_FACTOR:${marketAddress}:${isLong ? "1" : "0"}`)
}

function minExecutionFeeKey(): string {
  return hexFromUtf8("MIN_EXECUTION_FEE")
}

async function readDataStoreUint(keyHex: string): Promise<number> {
  try {
    const contractAddress = new Address(CONTRACTS.dataStore)

    const keyBytes = Uint8Array.from(
      keyHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)),
    )

    const tx = new TransactionBuilder(SIM_SOURCE, {
      fee: "100",
      networkPassphrase: NETWORK.networkPassphrase,
    })
      .addOperation(
        Operation.invokeHostFunction({
          function: xdr.HostFunction.hostFunctionTypeInvokeContract({
            contractAddress: contractAddress.toScAddress(),
            functionName: "getUint",
            args: [nativeToScVal(keyBytes, { type: "bytes" })],
          }),
        }),
      )
      .setTimeout(30)
      .build()

    const simulation = await sorobanRpc.simulateTransaction(tx.toXDR())

    if (rpc.Api.isSimulationError(simulation)) {
      return 0
    }

    if (!simulation.result?.retval) {
      return 0
    }

    return toNumber(scValToNative(simulation.result.retval))
  } catch {
    return 0
  }
}

export async function fetchFeeConfig(marketAddress: string): Promise<FeeConfig> {
  const posKey = positionFeeFactorKey(marketAddress, true)
  const swapKey = swapFeeFactorKey(marketAddress)
  const borrowKey = borrowingRateFactorKey(marketAddress, true)
  const execKey = minExecutionFeeKey()

  const [positionFeeBps, swapFeeBps, borrowingRateRaw, minExecutionFeeRaw] = await Promise.all([
    readDataStoreUint(posKey),
    readDataStoreUint(swapKey),
    readDataStoreUint(borrowKey),
    readDataStoreUint(execKey),
  ])

  return {
    positionFeeBps: positionFeeBps || DEFAULT_FEE_CONFIG.positionFeeBps,
    swapFeeBps: swapFeeBps || DEFAULT_FEE_CONFIG.swapFeeBps,
    borrowingRatePerHour:
      borrowingRateRaw > 0 ? borrowingRateRaw / 1_000_000 : DEFAULT_FEE_CONFIG.borrowingRatePerHour,
    minExecutionFeeXlm:
      minExecutionFeeRaw > 0 ? minExecutionFeeRaw / 10_000_000 : DEFAULT_FEE_CONFIG.minExecutionFeeXlm,
  }
}
