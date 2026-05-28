// TODO: Replace with real DataStore contract reads via Soroban when contracts are deployed.
// On-chain keys follow the pattern:
//    hex(`POSITION_FEE_FACTOR:{marketAddress}:{0|1}`)  → u32 fee basis points
//    hex(`SWAP_FEE_FACTOR:{marketAddress}`)             → u32 fee basis points
//    hex(`BORROWING_RATE_FACTOR:{marketAddress}:{0|1}`) → u32 rate (divided by 1_000_000)
//    hex("MIN_EXECUTION_FEE")                            → u32 stroops (divided by 10_000_000 for XLM)
//    hex(`MAX_POSITION_SIZE:{marketAddress}`)            → u64 USD value (divided by 10^30)

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

export async function fetchFeeConfig(_marketAddress: string): Promise<FeeConfig> {
  return { ...DEFAULT_FEE_CONFIG }
}
