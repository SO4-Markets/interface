import { useQuery } from "@tanstack/react-query"
import { Account, Contract, TransactionBuilder, rpc, scValToNative } from "@stellar/stellar-sdk"
import { TOKENS } from "../data/tokens"
import { sorobanRpc } from "../../../lib/soroban/client"
import { NETWORK } from "../../../app/config/network"
import { CONTRACTS } from "../../../app/config/contracts"
import type { Token } from "../data/tokens"

const DUMMY_ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"

async function fetchTokensFromChain(): Promise<Array<Token>> {
  try {
    const contract = new Contract(CONTRACTS.dataStore)
    const dummyAccount = new Account(DUMMY_ACCOUNT, "0")

    // 1. Fetch registered tokens list from DataStore
    const tx = new TransactionBuilder(dummyAccount, {
      fee: "100",
      networkPassphrase: NETWORK.networkPassphrase,
    })
      .addOperation(contract.call("get_registered_tokens"))
      .setTimeout(10)
      .build()

    const simulation = await sorobanRpc.simulateTransaction(tx)

    if (!rpc.Api.isSimulationSuccess(simulation)) {
      throw new Error("DataStore get_registered_tokens simulation failed")
    }

    const retval = simulation.result?.retval
    if (!retval) {
      throw new Error("No return value from DataStore get_registered_tokens")
    }

    const tokenAddresses = scValToNative(retval)
    if (!Array.isArray(tokenAddresses) || tokenAddresses.length === 0) {
      throw new Error("DataStore returned invalid or empty token list")
    }

    // 2. Fetch metadata (symbol, decimals, name) for each token — one sim per call
    //    because simulateTransaction only returns a single result (the last op).
    async function simCall(tokenContract: Contract, method: string) {
      const tx = new TransactionBuilder(dummyAccount, {
        fee: "100",
        networkPassphrase: NETWORK.networkPassphrase,
      })
        .addOperation(tokenContract.call(method))
        .setTimeout(10)
        .build()
      const sim = await sorobanRpc.simulateTransaction(tx)
      if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
        throw new Error(`${method} simulation failed`)
      }
      return scValToNative(sim.result.retval)
    }

    const tokens = await Promise.all(
      tokenAddresses.map(async (address: string) => {
        try {
          const tokenContract = new Contract(address)
          const [symbol, decimals, name] = await Promise.all([
            simCall(tokenContract, "symbol"),
            simCall(tokenContract, "decimals"),
            simCall(tokenContract, "name"),
          ])
          const sym = String(symbol)
          const isStable = sym.toUpperCase().includes("USD") || sym.toUpperCase() === "EUR"
          return {
            address,
            symbol: sym,
            name: String(name),
            decimals: Number(decimals),
            isStable,
            priceDecimals: isStable ? 4 : 2,
          }
        } catch (e) {
          console.warn(`Failed to fetch metadata on-chain for token ${address}`, e)
        }

        // Fallback for this specific token if metadata query fails
        const fallback = TOKENS.find((t) => t.address === address || t.symbol === address)
        if (fallback) {
          return { ...fallback, address }
        }

        return {
          address,
          symbol: address.slice(0, 4).toUpperCase(),
          name: `Token ${address.slice(0, 6)}`,
          decimals: 7,
          isStable: false,
          priceDecimals: 2,
        }
      })
    )

    return tokens
  } catch (error) {
    console.error("Failed to query token list from chain. Falling back to static list:", error)
    return TOKENS
  }
}

export function useTokenList() {
  const { data, isLoading, error } = useQuery<Array<Token>>({
    queryKey: ["tokenList", NETWORK.name],
    queryFn: fetchTokensFromChain,
    staleTime: 600_000, // 10 minutes cache
    gcTime: 1_200_000,
  })

  const tokens = data ?? TOKENS
  const stableTokens = tokens.filter((t) => t.isStable)
  const indexTokens = tokens.filter((t) => !t.isStable)

  const getToken = (addressOrSymbol: string): Token | undefined => {
    return tokens.find((t) => t.address === addressOrSymbol || t.symbol === addressOrSymbol)
  }

  return {
    tokens,
    stableTokens,
    indexTokens,
    getToken,
    isLoading,
    error,
  }
}
export type { Token }
