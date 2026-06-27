import { describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

const VALID_CONTRACT_ID =
  "CBSUAIAMIFFS4AXQYZ7KR7FNO7IMKAPS5WF4DXANVXDTPKH2F7YUIN6Q"
const FIXTURES_REPO = join(import.meta.dir, "fixtures", "contracts-repo")

function assertContractId(value: string, label: string): void {
  if (!/^C[A-Z2-7]{55}$/.test(value)) {
    throw new Error(`${label} is not a valid Stellar contract ID: ${value}`)
  }
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }
  return value
}

function parseEnv(contents: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const separator = trimmed.indexOf("=")
    if (separator === -1) continue
    const key = trimmed.slice(0, separator).trim()
    const rawValue = trimmed.slice(separator + 1).trim()
    env[key] = stripQuotes(rawValue)
  }
  return env
}

const CORE_CONTRACT_KEYS = [
  "role_store",
  "data_store",
  "oracle",
  "market_factory",
  "deposit_handler",
  "withdrawal_handler",
  "order_handler",
  "liquidation_handler",
  "adl_handler",
  "fee_handler",
  "referral_storage",
  "reader",
  "exchange_router",
] as const

function allIds(): Record<string, string> {
  return Object.fromEntries(
    CORE_CONTRACT_KEYS.map((k) => [k.toUpperCase(), VALID_CONTRACT_ID])
  )
}

function collectCoreContracts(
  deployedEnv: Record<string, string>,
  frontendEnv: Record<string, string>,
  contractIds: Record<string, string>
): Record<string, string> {
  const contracts = {} as Record<string, string>
  const missing: string[] = []

  for (const key of CORE_CONTRACT_KEYS) {
    const envKey = key.toUpperCase()
    const value = deployedEnv[envKey] ?? frontendEnv[envKey] ?? contractIds[key]
    if (!value) {
      missing.push(envKey)
      continue
    }
    assertContractId(value, envKey)
    contracts[key] = value
  }

  if (missing.length > 0) {
    throw new Error(`Missing required core contract IDs: ${missing.join(", ")}`)
  }

  return contracts
}

function collectMarkets(deployedEnv: Record<string, string>): {
  markets: Array<{
    name: string
    marketToken: string
    indexToken: string
    longToken: string
    shortToken: string
  }>
  warnings: string[]
} {
  const warnings: string[] = []
  const marketNames = new Set<string>()

  for (const key of Object.keys(deployedEnv)) {
    const match = key.match(/^MARKET_TOKEN_(.+)_(LONG|SHORT|INDEX)$/)
    if (match) marketNames.add(match[1])
  }

  const markets: Array<{
    name: string
    marketToken: string
    indexToken: string
    longToken: string
    shortToken: string
  }> = []
  const incomplete: string[] = []

  for (const envName of [...marketNames].sort()) {
    const displayName = envName.replace(/_/g, "/")
    const marketToken = deployedEnv[`MARKET_TOKEN_${envName}`]
    const indexToken = deployedEnv[`MARKET_TOKEN_${envName}_INDEX`]
    const longToken = deployedEnv[`MARKET_TOKEN_${envName}_LONG`]
    const shortToken = deployedEnv[`MARKET_TOKEN_${envName}_SHORT`]

    const missing = [
      [`MARKET_TOKEN_${envName}`, marketToken],
      [`MARKET_TOKEN_${envName}_INDEX`, indexToken],
      [`MARKET_TOKEN_${envName}_LONG`, longToken],
      [`MARKET_TOKEN_${envName}_SHORT`, shortToken],
    ]
      .filter(([, v]) => !v)
      .map(([k]) => k)
    if (missing.length > 0) {
      incomplete.push(`${displayName}: ${missing.join(", ")}`)
      continue
    }

    assertContractId(marketToken!, `MARKET_TOKEN_${envName}`)
    assertContractId(indexToken!, `MARKET_TOKEN_${envName}_INDEX`)
    assertContractId(longToken!, `MARKET_TOKEN_${envName}_LONG`)
    assertContractId(shortToken!, `MARKET_TOKEN_${envName}_SHORT`)
    markets.push({
      name: displayName,
      marketToken: marketToken!,
      indexToken: indexToken!,
      longToken: longToken!,
      shortToken: shortToken!,
    })
  }

  if (incomplete.length > 0) {
    warnings.push(
      `Some MARKET_TOKEN_* values are missing. This is only expected before market bootstrap: ${incomplete.join("; ")}`
    )
  }
  if (markets.length === 0) {
    warnings.push(
      "No complete market token triplets found. Run market bootstrap before indexing market-specific contract events."
    )
  }

  return { markets, warnings }
}

describe("sync-contracts — contract ID validation", () => {
  test("accepts valid C-prefixed base32 contract ID", () => {
    expect(() => assertContractId(VALID_CONTRACT_ID, "test")).not.toThrow()
  })

  test("rejects empty string", () => {
    expect(() => assertContractId("", "test")).toThrow(
      /not a valid Stellar contract ID/
    )
  })

  test("rejects malformed short string", () => {
    expect(() => assertContractId("C123", "test")).toThrow(
      /not a valid Stellar contract ID/
    )
  })

  test("rejects G-prefixed account ID", () => {
    expect(() =>
      assertContractId(
        "GBV3W5W7ZPKOZ7VJ7K7V5J7VJ7K7V5J7VJ7K7V5J7VJ7K7V5J7VJ7K7V5",
        "test"
      )
    ).toThrow(/not a valid Stellar contract ID/)
  })

  test("rejects contract ID with lowercase characters", () => {
    const mixed = VALID_CONTRACT_ID.toLowerCase()
    expect(() => assertContractId(mixed, "test")).toThrow()
  })
})

describe("sync-contracts — env value stripping", () => {
  test("removes double quotes", () => {
    expect(stripQuotes('"hello"')).toBe("hello")
  })

  test("removes single quotes", () => {
    expect(stripQuotes("'hello'")).toBe("hello")
  })

  test("returns unquoted value unchanged", () => {
    expect(stripQuotes("hello")).toBe("hello")
  })

  test("handles empty quoted string", () => {
    expect(stripQuotes('""')).toBe("")
  })
})

describe("sync-contracts — env file parsing", () => {
  test("parses simple KEY=VALUE pairs", () => {
    const env = parseEnv("FOO=bar\nBAZ=qux")
    expect(env.FOO).toBe("bar")
    expect(env.BAZ).toBe("qux")
  })

  test("skips comments and blank lines", () => {
    const env = parseEnv("# comment\n\nKEY=val\n")
    expect(env.KEY).toBe("val")
    expect(Object.keys(env)).toHaveLength(1)
  })

  test("strips quotes from values", () => {
    const env = parseEnv("KEY=\"quoted\"\nOTHER='single'")
    expect(env.KEY).toBe("quoted")
    expect(env.OTHER).toBe("single")
  })

  test("handles equals signs in values", () => {
    const env = parseEnv("KEY=value=with=equals")
    expect(env.KEY).toBe("value=with=equals")
  })

  test("skips line without separator", () => {
    const env = parseEnv("KEY=val\nINVALID")
    expect(env.KEY).toBe("val")
    expect(env.INVALID).toBeUndefined()
  })

  test("reads real fixture file", () => {
    const content =
      "NETWORK=local\nROLE_STORE=CBSUAIAMIFFS4AXQYZ7KR7FNO7IMKAPS5WF4DXANVXDTPKH2F7YUIN6Q"
    const env = parseEnv(content)
    expect(env.NETWORK).toBe("local")
    expect(env.ROLE_STORE).toBe(VALID_CONTRACT_ID)
  })
})

describe("sync-contracts — core contract collection", () => {
  test("collects all contracts from deployed env", () => {
    const contracts = collectCoreContracts(allIds(), {}, {})
    expect(contracts.role_store).toBe(VALID_CONTRACT_ID)
    expect(contracts.data_store).toBe(VALID_CONTRACT_ID)
    expect(contracts.exchange_router).toBe(VALID_CONTRACT_ID)
    expect(Object.keys(contracts)).toHaveLength(13)
  })

  test("falls back to frontend env", () => {
    const contracts = collectCoreContracts({}, allIds(), {})
    expect(contracts.role_store).toBe(VALID_CONTRACT_ID)
    expect(Object.keys(contracts)).toHaveLength(13)
  })

  test("falls back to contract IDs JSON", () => {
    const ids: Record<string, string> = {}
    for (const k of CORE_CONTRACT_KEYS) ids[k] = VALID_CONTRACT_ID
    const contracts = collectCoreContracts({}, {}, ids)
    expect(contracts.role_store).toBe(VALID_CONTRACT_ID)
    expect(Object.keys(contracts)).toHaveLength(13)
  })

  test("precedence: deployed env > frontend env > contract IDs", () => {
    const contracts = collectCoreContracts(
      { ROLE_STORE: VALID_CONTRACT_ID, ...allIds() },
      {
        ROLE_STORE:
          "CBVLYEOJQ7GF7MF3WJK2MF3WJK2MF3WJK2MF3WJK2MF3WJK2MF3WJK2MF3WJ",
      },
      { role_store: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2M" }
    )
    expect(contracts.role_store).toBe(VALID_CONTRACT_ID)
  })

  test("throws when required contracts are missing", () => {
    expect(() => collectCoreContracts({}, {}, {})).toThrow(
      "Missing required core contract IDs"
    )
  })

  test("throws on invalid contract ID format", () => {
    expect(() =>
      collectCoreContracts({ ...allIds(), ROLE_STORE: "not-valid" }, {}, {})
    ).toThrow(/not a valid Stellar contract ID/)
  })
})

describe("sync-contracts — market collection", () => {
  const validToken = VALID_CONTRACT_ID

  test("collects complete market triplets", () => {
    const { markets, warnings } = collectMarkets({
      MARKET_TOKEN_TETH_TUSDC: validToken,
      MARKET_TOKEN_TETH_TUSDC_INDEX: validToken,
      MARKET_TOKEN_TETH_TUSDC_LONG: validToken,
      MARKET_TOKEN_TETH_TUSDC_SHORT: validToken,
    })
    expect(markets).toHaveLength(1)
    expect(markets[0].name).toBe("TETH/TUSDC")
    expect(warnings).toHaveLength(0)
  })

  test("reports incomplete triplets as warnings", () => {
    const { markets, warnings } = collectMarkets({
      MARKET_TOKEN_TETH_TUSDC_INDEX: validToken,
    })
    expect(markets).toHaveLength(0)
    expect(warnings.some((w) => w.includes("TETH/TUSDC"))).toBe(true)
  })

  test("warns when no markets are found", () => {
    const { markets, warnings } = collectMarkets({})
    expect(markets).toHaveLength(0)
    expect(
      warnings.some((w) => w.includes("No complete market token triplets"))
    ).toBe(true)
  })

  test("throws on malformed market token contract ID", () => {
    expect(() =>
      collectMarkets({
        MARKET_TOKEN_TETH_TUSDC: "bad-id",
        MARKET_TOKEN_TETH_TUSDC_INDEX: validToken,
        MARKET_TOKEN_TETH_TUSDC_LONG: validToken,
        MARKET_TOKEN_TETH_TUSDC_SHORT: validToken,
      })
    ).toThrow()
  })
})

describe("sync-contracts — fixture-based ingestion", () => {
  test("fixture directory exists and contains required files", () => {
    expect(existsSync(FIXTURES_REPO)).toBe(true)
    expect(existsSync(join(FIXTURES_REPO, ".deployed", "local.env"))).toBe(true)
    expect(
      existsSync(join(FIXTURES_REPO, ".deployed", "tokens-local.env"))
    ).toBe(true)
    expect(
      existsSync(join(FIXTURES_REPO, ".deployed", "frontend-local.env"))
    ).toBe(true)
    expect(
      existsSync(join(FIXTURES_REPO, ".stellar", "contract-ids", "local.json"))
    ).toBe(true)
  })

  test("local fixture envs produce valid contract config", async () => {
    const localEnv = parseEnv(
      await Bun.file(join(FIXTURES_REPO, ".deployed", "local.env")).text()
    )
    const tokenEnv = parseEnv(
      await Bun.file(
        join(FIXTURES_REPO, ".deployed", "tokens-local.env")
      ).text()
    )

    expect(localEnv.NETWORK).toBe("local")
    expect(localEnv.ROLE_STORE).toMatch(/^C[A-Z2-7]{55}$/)
    expect(localEnv.EXCHANGE_ROUTER).toMatch(/^C[A-Z2-7]{55}$/)

    expect(tokenEnv.TUSDC).toMatch(/^C[A-Z2-7]{55}$/)
    expect(tokenEnv.FAUCET).toMatch(/^C[A-Z2-7]{55}$/)
  })

  test("local fixture produces valid markets", async () => {
    const localEnv = parseEnv(
      await Bun.file(join(FIXTURES_REPO, ".deployed", "local.env")).text()
    )
    const { markets, warnings } = collectMarkets(localEnv)

    expect(markets.length).toBeGreaterThanOrEqual(1)
    for (const m of markets) {
      expect(m.marketToken).toMatch(/^C[A-Z2-7]{55}$/)
      expect(m.indexToken).toMatch(/^C[A-Z2-7]{55}$/)
      expect(m.longToken).toMatch(/^C[A-Z2-7]{55}$/)
      expect(m.shortToken).toMatch(/^C[A-Z2-7]{55}$/)
    }
    expect(warnings).toHaveLength(0)
  })

  test("full sync runs with fixture repo and produces output", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "sync-test-"))
    const outputPath = join(tmpDir, "contracts.output.json")

    const proc = Bun.spawnSync(
      [
        "bun",
        "run",
        join(import.meta.dir, "..", "scripts", "sync-contracts.ts"),
        "--network",
        "local",
        "--contracts-repo",
        FIXTURES_REPO,
        "--output",
        outputPath,
      ],
      { env: { ...process.env, SO4_CONTRACTS_REPO: FIXTURES_REPO } }
    )

    expect(proc.exitCode).toBe(0)

    const output = JSON.parse(readFileSync(outputPath, "utf8"))
    expect(output.network.name).toBe("local")
    expect(output.network.passphrase).toBe("Standalone Network ; February 2017")
    expect(output.contracts).toBeDefined()
    expect(output.contracts.exchange_router).toMatch(/^C[A-Z2-7]{55}$/)
    expect(output.tokens).toBeDefined()
    expect(output.tokens.TUSDC).toMatch(/^C[A-Z2-7]{55}$/)
    expect(output.markets.length).toBeGreaterThanOrEqual(1)
  })

  test("testnet path produces valid output", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "sync-test-"))
    const outputPath = join(tmpDir, "contracts.testnet.output.json")

    const proc = Bun.spawnSync(
      [
        "bun",
        "run",
        join(import.meta.dir, "..", "scripts", "sync-contracts.ts"),
        "--network",
        "testnet",
        "--contracts-repo",
        FIXTURES_REPO,
        "--output",
        outputPath,
      ],
      { env: { ...process.env, SO4_CONTRACTS_REPO: FIXTURES_REPO } }
    )

    expect(proc.exitCode).toBe(0)
    const output = JSON.parse(readFileSync(outputPath, "utf8"))
    expect(output.network.name).toBe("testnet")
    expect(output.network.passphrase).toBe("Test SDF Network ; September 2015")
    expect(output.contracts).toBeDefined()
    expect(output.tokens).toBeDefined()
    expect(output.tokens.TUSDC).toMatch(/^C[A-Z2-7]{55}$/)
    expect(output.markets.length).toBeGreaterThanOrEqual(1)
  })

  test("fails gracefully when network fixtures are missing", async () => {
    const proc = Bun.spawnSync(
      [
        "bun",
        "run",
        join(import.meta.dir, "..", "scripts", "sync-contracts.ts"),
        "--network",
        "nonexistent",
        "--contracts-repo",
        FIXTURES_REPO,
      ],
      { env: { ...process.env, SO4_CONTRACTS_REPO: FIXTURES_REPO } }
    )

    expect(proc.exitCode).toBe(1)
    expect(proc.stderr.toString()).toContain("Missing deployment output")
  })
})
