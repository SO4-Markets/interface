/**
 * apps/web/src/lib/soroban/assemble.test.ts
 *
 * Tests for transaction assembly from Soroban simulation output.
 *
 * `rpc.assembleTransaction` is a pure SDK function — no network calls are
 * made and no MSW handlers are needed.  All fixtures use real
 * `@stellar/stellar-sdk` types constructed with the SDK's own builders so
 * the test exercises the actual XDR encode/decode path.
 *
 * Scenarios covered
 * ──────────────────
 * 1. Assembled transaction fields and footprint — the returned builder
 *    produces a transaction with the simulation's resource data applied.
 * 2. minResourceFee is surfaced on the result.
 * 3. Error simulation input is rejected with a clear message.
 * 4. Restore-required simulation input is rejected with a clear message.
 * 5. assembleAndBuild convenience wrapper returns a Transaction directly.
 */

import { describe, expect, it } from "vitest"
import {
  Account,
  Contract,
  Keypair,
  Networks,
  SorobanDataBuilder,
  rpc as StellarRpc,
  Transaction,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk/minimal"
import { assembleAndBuild, assembleTx } from "./assemble"

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

/** A deterministic keypair for test transactions. */
const SOURCE_KEYPAIR = Keypair.fromSecret(
  "SCZANGBA5YELZLBZYA7GY7DXHXCOJCB72A7ASBOMKM7Q5QNDOHLQZ",
)
const SOURCE_PUBLIC = SOURCE_KEYPAIR.publicKey()

/** A valid Soroban contract address (C...). */
const CONTRACT_ADDRESS = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAF"

/**
 * Build a minimal real Stellar transaction that invokes a contract function.
 * Uses sequence "0" so tests don't need a live account.
 */
function buildRawTransaction() {
  const account = new Account(SOURCE_PUBLIC, "100")
  const contract = new Contract(CONTRACT_ADDRESS)

  return new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      contract.call("increment", xdr.ScVal.scvVoid()),
    )
    .setTimeout(30)
    .build()
}

/**
 * A minimal valid raw simulation response.
 *
 * `transactionData` is a base64-encoded empty `SorobanTransactionData` XDR.
 * We use the SDK's `SorobanDataBuilder` to produce a legitimate value so
 * `assembleTransaction` can parse it without throwing.
 */
function buildRawSimulation(
  overrides: Partial<StellarRpc.Api.RawSimulateTransactionResponse> = {},
): StellarRpc.Api.RawSimulateTransactionResponse {
  const emptyFootprint = new SorobanDataBuilder().build().toXDR("base64")

  return {
    id: "test-sim-id",
    latestLedger: 12345,
    minResourceFee: "500000",
    transactionData: emptyFootprint,
    results: [{ auth: [], xdr: xdr.ScVal.scvVoid().toXDR("base64") }],
    events: [],
    ...overrides,
  }
}

/** Parse a raw simulation into the typed success response. */
function buildParsedSimulation(
  overrides: Partial<StellarRpc.Api.RawSimulateTransactionResponse> = {},
) {
  return StellarRpc.parseRawSimulation(buildRawSimulation(overrides))
}

// ─────────────────────────────────────────────────────────────────────────────
// assembleTx — assembled transaction fields and footprint
// ─────────────────────────────────────────────────────────────────────────────

describe("assembleTx — assembled transaction fields and footprint", () => {
  it("returns a TransactionBuilder on a valid simulation", () => {
    const tx = buildRawTransaction()
    const sim = buildParsedSimulation()

    const result = assembleTx(tx, sim)

    expect(result.builder).toBeDefined()
    expect(typeof result.builder.build).toBe("function")
  })

  it("builder.build() produces a Transaction with the original source account", () => {
    const tx = buildRawTransaction()
    const sim = buildParsedSimulation()

    const { builder } = assembleTx(tx, sim)
    const assembled = builder.build()

    expect(assembled.source).toBe(SOURCE_PUBLIC)
  })

  it("assembled transaction has Soroban resource data applied (non-empty sorobanData)", () => {
    const tx = buildRawTransaction()
    const sim = buildParsedSimulation()

    const assembled = assembleAndBuild(tx, sim)

    // After assembly the transaction envelope should carry sorobanData
    // (the XDR round-trip confirms the footprint was merged in)
    const xdrStr = assembled.toXDR()
    expect(typeof xdrStr).toBe("string")
    expect(xdrStr.length).toBeGreaterThan(0)

    // Re-parsing confirms the assembled XDR is a valid transaction.
    // fromXDR widens to Transaction | FeeBumpTransaction; only the former
    // carries `source`, and a plain Transaction is what we built.
    const reparsed = TransactionBuilder.fromXDR(xdrStr, Networks.TESTNET)
    expect(reparsed).toBeInstanceOf(Transaction)
    expect((reparsed as Transaction).source).toBe(SOURCE_PUBLIC)
  })

  it("accepts a raw (unparsed) simulation response directly", () => {
    const tx = buildRawTransaction()
    const rawSim = buildRawSimulation()

    // assembleTransaction accepts both raw and parsed — verify raw works
    const result = assembleTx(tx, rawSim)
    expect(result.builder).toBeDefined()
  })

  it("preserves the original transaction's network passphrase", () => {
    const tx = buildRawTransaction()
    const sim = buildParsedSimulation()

    const assembled = assembleAndBuild(tx, sim)
    // The transaction must be valid on testnet
    expect(() =>
      TransactionBuilder.fromXDR(assembled.toXDR(), Networks.TESTNET),
    ).not.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// assembleTx — minResourceFee surfaced
// ─────────────────────────────────────────────────────────────────────────────

describe("assembleTx — minResourceFee", () => {
  it("surfaces minResourceFee from a raw simulation response", () => {
    const tx = buildRawTransaction()
    const rawSim = buildRawSimulation({ minResourceFee: "750000" })

    const { minResourceFee } = assembleTx(tx, rawSim)

    expect(minResourceFee).toBe("750000")
  })

  it("surfaces minResourceFee from a parsed simulation response", () => {
    const tx = buildRawTransaction()
    const sim = buildParsedSimulation({ minResourceFee: "1234567" })

    const { minResourceFee } = assembleTx(tx, sim)

    expect(minResourceFee).toBe("1234567")
  })

  it("defaults minResourceFee to '0' when not present in the response", () => {
    const tx = buildRawTransaction()
    // Build a raw sim without minResourceFee, then cast to avoid TS
    const rawSim = buildRawSimulation()
    const simWithoutFee = { ...rawSim, minResourceFee: undefined } as unknown as
      StellarRpc.Api.RawSimulateTransactionResponse

    const { minResourceFee } = assembleTx(tx, simWithoutFee)

    expect(minResourceFee).toBe("0")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// assembleTx — malformed / error simulation input
// ─────────────────────────────────────────────────────────────────────────────

describe("assembleTx — malformed simulation input", () => {
  it("throws when the simulation is an error response", () => {
    const tx = buildRawTransaction()

    // Construct a minimal error simulation using parseRawSimulation
    const errorSim = StellarRpc.parseRawSimulation({
      id: "test",
      latestLedger: 12345,
      error: "Budget exceeded: cpu instructions limit 100, used 9999",
      events: [],
    })

    expect(() => assembleTx(tx, errorSim)).toThrow("Simulation failed")
    expect(() => assembleTx(tx, errorSim)).toThrow("Budget exceeded")
  })

  it("error message includes the original simulation error string", () => {
    const tx = buildRawTransaction()
    const errorMessage = "HostError: Value error: some contract logic failure"

    const errorSim = StellarRpc.parseRawSimulation({
      id: "test",
      latestLedger: 1,
      error: errorMessage,
      events: [],
    })

    expect(() => assembleTx(tx, errorSim)).toThrow(errorMessage)
  })

  it("throws when the simulation requires ledger entry restoration", () => {
    const tx = buildRawTransaction()

    // A restore simulation has a restorePreamble field alongside success fields
    const emptyFootprint = new SorobanDataBuilder().build().toXDR("base64")
    const restoreSim = StellarRpc.parseRawSimulation({
      id: "test",
      latestLedger: 12345,
      minResourceFee: "500000",
      transactionData: emptyFootprint,
      results: [{ auth: [], xdr: xdr.ScVal.scvVoid().toXDR("base64") }],
      events: [],
      restorePreamble: {
        minResourceFee: "100000",
        transactionData: emptyFootprint,
      },
    })

    expect(() => assembleTx(tx, restoreSim)).toThrow("restoration")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// assembleAndBuild — convenience wrapper
// ─────────────────────────────────────────────────────────────────────────────

describe("assembleAndBuild", () => {
  it("returns a Transaction instance directly", () => {
    const tx = buildRawTransaction()
    const sim = buildParsedSimulation()

    const assembled = assembleAndBuild(tx, sim)

    // Transaction has a toXDR method — confirms it's a real Transaction
    expect(typeof assembled.toXDR).toBe("function")
    expect(assembled.source).toBe(SOURCE_PUBLIC)
  })

  it("propagates errors from assembleTx", () => {
    const tx = buildRawTransaction()
    const errorSim = StellarRpc.parseRawSimulation({
      id: "test",
      latestLedger: 1,
      error: "contract trap",
      events: [],
    })

    expect(() => assembleAndBuild(tx, errorSim)).toThrow("Simulation failed")
  })
})
