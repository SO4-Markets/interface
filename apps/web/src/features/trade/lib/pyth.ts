import { HermesClient } from "@pythnetwork/hermes-client"
import { getMarket } from "../data/markets"
import { PYTH_FEED_IDS } from "./pyth-feed-ids"
import { ENV } from "@/app/config/env"

export { PYTH_FEED_IDS }

export const ORACLE_FRESH_MS = 5_000
export const ORACLE_STALE_MS = 30_000

export type OracleStaleness = "fresh" | "warning" | "stale"

export type PythPriceAttestation = {
  symbol: string
  minPrice: number
  maxPrice: number
  publishTimeMs: number
  priceUpdateData: Uint8Array
}

let hermesClient: HermesClient | null = null

function getHermesClient(): HermesClient {
  if (!hermesClient) {
    hermesClient = new HermesClient(ENV.PYTH_HERMES_URL, {})
  }
  return hermesClient
}

export function getOracleStaleness(updatedAtMs: number, now = Date.now()): OracleStaleness {
  const ageMs = now - updatedAtMs
  if (ageMs <= ORACLE_FRESH_MS) return "fresh"
  if (ageMs <= ORACLE_STALE_MS) return "warning"
  return "stale"
}

export function assertPriceAttestationFresh(publishTimeMs: number, now = Date.now()): void {
  if (now - publishTimeMs > ORACLE_STALE_MS) {
    throw new Error("Pyth price attestation is stale (> 30s). Please retry.")
  }
}

function parsePythUsdPrice(price: string, expo: number): number {
  const mantissa = Number(price)
  if (!Number.isFinite(mantissa)) return 0
  return mantissa * 10 ** expo
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith("0x") ? hex.slice(2) : hex
  const bytes = new Uint8Array(normalized.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/** Fetch latest Pyth prices and binary attestations for the given symbols. */
export async function fetchPythAttestations(
  symbols: Array<string>,
): Promise<Array<PythPriceAttestation>> {
  const ids = symbols
    .map((sym) => PYTH_FEED_IDS[sym])
    .filter((id): id is string => Boolean(id))

  if (ids.length === 0) return []

  const client = getHermesClient()
  const response = await client.getLatestPriceUpdates(ids, {
    encoding: "hex",
    parsed: true,
    ignoreInvalidPriceIds: true,
  })

  const binaryChunks = response.binary.data
  const parsed = response.parsed ?? []

  const byFeedId = new Map(
    parsed.map((entry, index) => [
      entry.id,
      {
        entry,
        binary: binaryChunks[index] ? hexToBytes(binaryChunks[index]) : null,
      },
    ]),
  )

  const results: Array<PythPriceAttestation> = []

  for (const sym of symbols) {
    const feedId = PYTH_FEED_IDS[sym]
    if (!feedId) continue

    const row = byFeedId.get(feedId)
    if (!row?.entry.price || !row.binary) continue

    const { price, conf } = row.entry.price
    const expo = row.entry.price.expo
    const mid = parsePythUsdPrice(price, expo)
    const spread = parsePythUsdPrice(conf, expo)
    const publishTimeMs = Number(row.entry.price.publish_time) * 1000

    results.push({
      symbol: sym,
      minPrice: Math.max(0, mid - spread / 2),
      maxPrice: mid + spread / 2,
      publishTimeMs,
      priceUpdateData: row.binary,
    })
  }

  return results
}

/** Fetch fresh binary price update payloads for on-chain order transactions. */
export async function fetchFreshPriceUpdateData(
  symbols: Array<string>,
): Promise<{ priceUpdateData: Array<Uint8Array>; publishTimeMs: number }> {
  const attestations = await fetchPythAttestations(symbols)
  if (attestations.length === 0) {
    throw new Error("Unable to fetch Pyth price attestations for this market.")
  }

  const newest = attestations.reduce((a, b) =>
    a.publishTimeMs >= b.publishTimeMs ? a : b,
  )
  assertPriceAttestationFresh(newest.publishTimeMs)

  return {
    priceUpdateData: attestations.map((a) => a.priceUpdateData),
    publishTimeMs: newest.publishTimeMs,
  }
}

export function symbolsForMarket(indexToken: string): Array<string> {
  const symbols = new Set<string>([indexToken, "USDC"])
  if (indexToken !== "XLM") symbols.add("XLM")
  return [...symbols].filter((s) => PYTH_FEED_IDS[s])
}

/** Resolve Pyth attestations required for a market's index token. */
export async function fetchPriceUpdateDataForMarket(
  marketAddress: string,
  indexTokenFallback: string,
): Promise<Array<Uint8Array>> {
  const market = getMarket(marketAddress)
  const indexToken = market?.indexTokenAddress ?? indexTokenFallback
  const { priceUpdateData } = await fetchFreshPriceUpdateData(symbolsForMarket(indexToken))
  return priceUpdateData
}

/** Resolve Pyth attestations for a swap between two tokens. */
export async function fetchPriceUpdateDataForSwap(
  fromToken: string,
  toToken: string,
): Promise<Array<Uint8Array>> {
  const symbols = [...new Set([...symbolsForMarket(fromToken), ...symbolsForMarket(toToken)])]
  const { priceUpdateData } = await fetchFreshPriceUpdateData(symbols)
  return priceUpdateData
}
