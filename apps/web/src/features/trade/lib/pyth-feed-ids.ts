/**
 * Pyth price feed IDs (hex, with 0x prefix). Kept dependency-free so the
 * server-side Hermes proxy (server/api/pyth) can import the same allowlist.
 */
export const PYTH_FEED_IDS: Record<string, string> = {
  BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  XLM: "0x8f283a54eb408247a4569a5c26c2c6867e77e17d8cdb1fc6cf4f1ea0280e5f9",
  USDC: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
}
