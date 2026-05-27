import { useQuery } from "@tanstack/react-query"
import { Contract, Account, TransactionBuilder, rpc, scValToNative } from "@stellar/stellar-sdk"
import { TOKENS } from "../data/tokens"
import type { Token } from "../data/tokens"
import { sorobanRpc } from "../../../lib/soroban/client"
import { NETWORK } from "../../../app/config/network"
import { CONTRACTS } from "../../../app/config/contracts"

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

    // 2. Fetch metadata (symbol, decimals, name) for each token on-chain from its SAC contract
    const tokens = await Promise.all(
      tokenAddresses.map(async (address: string) => {
        try {
          const tokenContract = new Contract(address)
          const metaTx = new TransactionBuilder(dummyAccount, {
            fee: "100",
            networkPassphrase: NETWORK.networkPassphrase,
          })
            .addOperation(tokenContract.call("symbol"))
            .addOperation(tokenContract.call("decimals"))
            .addOperation(tokenContract.call("name"))
            .setTimeout(10)
            .build()

          const metaSim = await sorobanRpc.simulateTransaction(metaTx)

          if (
            rpc.Api.isSimulationSuccess(metaSim) &&
            metaSim.results &&
            metaSim.results.length >= 3
          ) {
            const symbol = String(scValToNative(metaSim.results[0].retval))
            const decimals = Number(scValToNative(metaSim.results[1].retval))
            const name = String(scValToNative(metaSim.results[2].retval))
            const isStable = symbol.toUpperCase().includes("USD") || symbol.toUpperCase() === "EUR"

            return {
              address,
              symbol,
              name,
              decimals,
              isStable,
              priceDecimals: isStable ? 4 : 2,
            }
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
