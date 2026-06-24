// SO4 protocol actions for the smoke flow.
//
// These composites mirror the proven contract-repo shell scripts
// (seed_liquidity.sh, test_positions.sh) but build the Soroban argument JSON
// directly in TypeScript — no python dependency — and submit fixed local oracle
// prices via `set_prices_simple`, which the local oracle build exposes for testing.
//
// Amount conventions (matching the contracts):
//   TOKEN_PRECISION  = 1e7   → 1 token  = 10_000_000 raw units (7 decimals)
//   FLOAT_PRECISION  = 1e30  → USD/price values are scaled by 1e30

import { invoke, invokeRaw, type StellarContext } from "./stellar";

export const FLOAT_PRECISION = 10n ** 30n;
export const ONE_TOKEN = 10_000_000n; // 1 token at 7 decimals

/** Fixed local USD prices per ticker (min == max for deterministic execution). */
const PRICE_USD: Record<string, bigint> = {
  TUSDC: 1n,
  TWBTC: 2000n,
  TETH: 2000n,
  TXLM: 1n,
};

export function priceFor(code: string): bigint {
  return (PRICE_USD[code] ?? 1n) * FLOAT_PRECISION;
}

export interface PriceEntry {
  token: string;
  price: bigint;
}

/** Pull a transaction hash out of stellar CLI stderr, when present. */
export function extractTxHash(stderr: string): string | undefined {
  const match = stderr.match(/\b[0-9a-f]{64}\b/);
  return match?.[0];
}

interface InvokeOutcome {
  stdout: string;
  txHash?: string;
}

/** Invoke and return both the parsed value and any tx hash from the logs. */
function invokeWithHash(
  ctx: StellarContext,
  contractId: string,
  fn: string,
  args: string[],
): InvokeOutcome {
  const result = invokeRaw(ctx, contractId, fn, args);
  if (result.code !== 0) {
    const tail = result.stderr.trim() || result.stdout.trim();
    throw new Error(`invoke ${fn} on ${contractId} failed (${result.code}): ${tail}`);
  }
  return { stdout: result.stdout.trim(), txHash: extractTxHash(result.stderr) };
}

function unquote(value: string): string {
  return value.replace(/^"|"$/g, "");
}

// ── Oracle ────────────────────────────────────────────────────────────────────

/** Submit fixed min==max prices for the given tokens via set_prices_simple. */
export function submitPrices(
  ctx: StellarContext,
  oracle: string,
  caller: string,
  prices: PriceEntry[],
): void {
  const payload = prices.map((entry) => ({
    token: entry.token,
    min: entry.price.toString(),
    max: entry.price.toString(),
  }));

  invoke(ctx, oracle, "set_prices_simple", [
    "--caller",
    caller,
    "--prices",
    JSON.stringify(payload),
  ]);
}

// ── Tokens / faucet ─────────────────────────────────────────────────────────────

/** Claim test tokens from the faucet. Cooldown failures are tolerated. */
export function claimFaucet(
  ctx: StellarContext,
  faucet: string,
  account: string,
  token: string,
): boolean {
  const result = invokeRaw(ctx, faucet, "claim", ["--account", account, "--token", token]);
  return result.code === 0;
}

/** Approve a spender to pull tokens until `expirationLedger`. */
export function approve(
  ctx: StellarContext,
  token: string,
  from: string,
  spender: string,
  amount: bigint,
  expirationLedger: number,
): void {
  invoke(ctx, token, "approve", [
    "--from",
    from,
    "--spender",
    spender,
    "--amount",
    amount.toString(),
    "--expiration_ledger",
    String(expirationLedger),
  ]);
}

// ── Deposit ─────────────────────────────────────────────────────────────────────

export interface DepositFlowInput {
  depositHandler: string;
  oracle: string;
  market: string;
  longToken: string;
  shortToken: string;
  keeperAddr: string;
  longAmount: bigint;
  shortAmount: bigint;
  expirationLedger: number;
  prices: PriceEntry[];
}

export interface DepositFlowResult {
  depositKey: string;
  createTxHash?: string;
  executeTxHash?: string;
}

/** Approve, create, and execute a liquidity deposit into the market pool. */
export function depositFlow(ctx: StellarContext, input: DepositFlowInput): DepositFlowResult {
  submitPrices(ctx, input.oracle, input.keeperAddr, input.prices);

  approve(ctx, input.longToken, input.keeperAddr, input.depositHandler, input.longAmount, input.expirationLedger);
  if (input.shortToken !== input.longToken) {
    approve(ctx, input.shortToken, input.keeperAddr, input.depositHandler, input.shortAmount, input.expirationLedger);
  }

  const params = {
    receiver: input.keeperAddr,
    market: input.market,
    initial_long_token: input.longToken,
    initial_short_token: input.shortToken,
    long_token_amount: input.longAmount.toString(),
    short_token_amount: input.shortAmount.toString(),
    min_market_tokens: "0",
    execution_fee: "0",
  };

  const created = invokeWithHash(ctx, input.depositHandler, "create_deposit", [
    "--caller",
    input.keeperAddr,
    "--params",
    JSON.stringify(params),
  ]);
  const depositKey = unquote(created.stdout);

  // Oracle temp prices may expire between transactions — refresh before execute.
  submitPrices(ctx, input.oracle, input.keeperAddr, input.prices);

  const executed = invokeWithHash(ctx, input.depositHandler, "execute_deposit", [
    "--keeper",
    input.keeperAddr,
    "--key",
    depositKey,
  ]);

  return { depositKey, createTxHash: created.txHash, executeTxHash: executed.txHash };
}

// ── Orders / positions ──────────────────────────────────────────────────────────

type OrderType = "MarketIncrease" | "MarketDecrease";

export interface OpenPositionInput {
  orderHandler: string;
  orderVault: string;
  exchangeRouter: string;
  oracle: string;
  market: string;
  keeperAddr: string;
  collateralToken: string;
  collateralAmount: bigint;
  sizeDeltaUsd: bigint;
  acceptablePrice: bigint;
  isLong: boolean;
  expirationLedger: number;
  prices: PriceEntry[];
}

export interface OrderFlowResult {
  orderKey: string;
  createTxHash?: string;
  executeTxHash?: string;
}

function buildOrderParams(args: {
  keeperAddr: string;
  market: string;
  collateralToken: string;
  sizeDeltaUsd: bigint;
  collateralDeltaAmount: bigint;
  acceptablePrice: bigint;
  orderType: OrderType;
  isLong: boolean;
}): string {
  return JSON.stringify({
    receiver: args.keeperAddr,
    market: args.market,
    initial_collateral_token: args.collateralToken,
    swap_path: [],
    size_delta_usd: args.sizeDeltaUsd.toString(),
    collateral_delta_amount: args.collateralDeltaAmount.toString(),
    trigger_price: "0",
    acceptable_price: args.acceptablePrice.toString(),
    execution_fee: "0",
    min_output_amount: "0",
    order_type: { [args.orderType]: null },
    is_long: args.isLong,
  });
}

/** Approve collateral, fund the order vault, create and execute a MarketIncrease. */
export function openPositionFlow(ctx: StellarContext, input: OpenPositionInput): OrderFlowResult {
  approve(
    ctx,
    input.collateralToken,
    input.keeperAddr,
    input.exchangeRouter,
    input.collateralAmount,
    input.expirationLedger,
  );

  submitPrices(ctx, input.oracle, input.keeperAddr, input.prices);

  invoke(ctx, input.exchangeRouter, "send_tokens", [
    "--caller",
    input.keeperAddr,
    "--token",
    input.collateralToken,
    "--receiver",
    input.orderVault,
    "--amount",
    input.collateralAmount.toString(),
  ]);

  const created = invokeWithHash(ctx, input.orderHandler, "create_order", [
    "--caller",
    input.keeperAddr,
    "--params",
    buildOrderParams({
      keeperAddr: input.keeperAddr,
      market: input.market,
      collateralToken: input.collateralToken,
      sizeDeltaUsd: input.sizeDeltaUsd,
      collateralDeltaAmount: 0n,
      acceptablePrice: input.acceptablePrice,
      orderType: "MarketIncrease",
      isLong: input.isLong,
    }),
  ]);
  const orderKey = unquote(created.stdout);

  submitPrices(ctx, input.oracle, input.keeperAddr, input.prices);

  const executed = invokeWithHash(ctx, input.orderHandler, "execute_order", [
    "--keeper",
    input.keeperAddr,
    "--key",
    orderKey,
  ]);

  return { orderKey, createTxHash: created.txHash, executeTxHash: executed.txHash };
}

export interface ClosePositionInput {
  orderHandler: string;
  oracle: string;
  market: string;
  keeperAddr: string;
  collateralToken: string;
  sizeDeltaUsd: bigint;
  acceptablePrice: bigint;
  isLong: boolean;
  prices: PriceEntry[];
}

/** Create and execute a MarketDecrease that reduces or closes a position. */
export function closePositionFlow(ctx: StellarContext, input: ClosePositionInput): OrderFlowResult {
  submitPrices(ctx, input.oracle, input.keeperAddr, input.prices);

  const created = invokeWithHash(ctx, input.orderHandler, "create_order", [
    "--caller",
    input.keeperAddr,
    "--params",
    buildOrderParams({
      keeperAddr: input.keeperAddr,
      market: input.market,
      collateralToken: input.collateralToken,
      sizeDeltaUsd: input.sizeDeltaUsd,
      collateralDeltaAmount: 0n,
      acceptablePrice: input.acceptablePrice,
      orderType: "MarketDecrease",
      isLong: input.isLong,
    }),
  ]);
  const orderKey = unquote(created.stdout);

  submitPrices(ctx, input.oracle, input.keeperAddr, input.prices);

  const executed = invokeWithHash(ctx, input.orderHandler, "execute_order", [
    "--keeper",
    input.keeperAddr,
    "--key",
    orderKey,
  ]);

  return { orderKey, createTxHash: created.txHash, executeTxHash: executed.txHash };
}

// ── Referral (optional) ─────────────────────────────────────────────────────────

export interface ReferralFlowResult {
  code: string;
  registerTxHash?: string;
  setTxHash?: string;
}

/** A deterministic 32-byte referral code derived from a short label. */
export function referralCodeHex(label: string): string {
  const bytes = Buffer.alloc(32);
  Buffer.from(label, "utf8").copy(bytes, 0, 0, Math.min(label.length, 32));
  return bytes.toString("hex");
}

/** Register a referral code and assign the trader to it. */
export function referralFlow(
  ctx: StellarContext,
  referralStorage: string,
  trader: string,
  label: string,
): ReferralFlowResult {
  const code = referralCodeHex(label);

  const registered = invokeWithHash(ctx, referralStorage, "register_code", [
    "--caller",
    trader,
    "--code",
    code,
  ]);

  const set = invokeWithHash(ctx, referralStorage, "set_trader_referral_code", [
    "--trader",
    trader,
    "--code",
    code,
  ]);

  return { code, registerTxHash: registered.txHash, setTxHash: set.txHash };
}
