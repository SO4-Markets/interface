import { Account, Contract, rpc, scValToNative, TransactionBuilder, xdr } from "@stellar/stellar-sdk"
import { CONTRACTS } from "@/app/config/contracts"
import { NETWORK } from "@/app/config/network"
import { sorobanRpc } from "@/lib/soroban/client"

const DUMMY_ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"

export type FeeConfig = {
  positionFeeBps: number
  swapFeeBps: number
  borrowingRatePerHour: number
  minExecutionFeeXlm: number
  maxPositionSizeUsd: number
}

export const DEFAULT_FEE_CONFIG: FeeConfig = {
  positionFeeBps: 10,
  swapFeeBps: 10,
  borrowingRatePerHour: 0.0001,
  minExecutionFeeXlm: 0.3,
  maxPositionSizeUsd: 5_000_000,
}

export type CircuitBreakerStatus = {
  symbol: string
  active: boolean
  message: string
}

/** DataStore key: SHA-256("ORACLE_CIRCUIT_BREAKER:{symbol}") → BytesN<32>. */
async function oracleCircuitBreakerKey(symbol: string): Promise<Buffer> {
  const payload = new TextEncoder().encode(`ORACLE_CIRCUIT_BREAKER:${symbol}`)
  const digest = await crypto.subtle.digest("SHA-256", payload)
  return Buffer.from(digest)
}

async function dataStoreGetBool(key: Buffer): Promise<boolean> {
  const contract = new Contract(CONTRACTS.dataStore)
  const dummyAccount = new Account(DUMMY_ACCOUNT, "0")

  const tx = new TransactionBuilder(dummyAccount, {
    fee: "100",
    networkPassphrase: NETWORK.networkPassphrase,
  })
    .addOperation(
      contract.call(
        "get_bool",
        xdr.ScVal.scvBytes(key),
      ),
    )
    .setTimeout(10)
    .build()

  const simulation = await sorobanRpc.simulateTransaction(tx)
  if (!rpc.Api.isSimulationSuccess(simulation)) {
    throw new Error("DataStore get_bool simulation failed")
  }

  const retval = simulation.result?.retval
  if (!retval) return false
  return Boolean(scValToNative(retval))
}

export async function fetchFeeConfig(_marketAddress: string): Promise<FeeConfig> {
  return { ...DEFAULT_FEE_CONFIG }
}

/** Read oracle circuit-breaker flag for a market index token from DataStore. */
export async function fetchCircuitBreakerStatus(
  symbol: string,
): Promise<CircuitBreakerStatus | null> {
  try {
    const key = await oracleCircuitBreakerKey(symbol)
    const active = await dataStoreGetBool(key)
    if (!active) return null

    return {
      symbol,
      active: true,
      message: `${symbol}/USD trading paused: abnormal price movement detected.`,
    }
  } catch {
    return null
  }
}
