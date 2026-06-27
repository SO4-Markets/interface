import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { HttpResponse, http } from "msw"
import { Account, Networks, TransactionBuilder, nativeToScVal, rpc } from "@stellar/stellar-sdk"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import { server } from "@/test/msw/server"
import { fakeWalletAddress } from "@/test/fakes/wallet"
import { FaucetPage } from "./faucet-page"

// ── Fixed seed values ─────────────────────────────────────────────────────────
// fromContractAmount divides raw bigint by 1e7
// 10_000_000n / 1e7 = 1  → formatToken → "1 TUSDC"
// 50_000_000n / 1e7 = 5  → formatToken → "5 TUSDC"
const CLAIM_AMOUNT_RAW = 10_000_000n
const BALANCE_RAW = 50_000_000n
const COOLDOWN_LEDGERS = 100
const LAST_CLAIM_LEDGER = 999

// ── UI and claim mocks ────────────────────────────────────────────────────────
// useClaim is stubbed because it transitively imports @/lib/contracts.ts, which
// instantiates contract clients at module-load time with test contract IDs that
// fail Stellar strkey validation in bun's test runner.  The data-fetching path
// (useFaucetData / lib/clients / data/tokens) is left completely real.
vi.mock("../hooks/useClaim", () => ({
  useClaim: () => ({
    claimOne: vi.fn(),
    claimAll: vi.fn(),
    pendingTokens: new Set<string>(),
    isBulkPending: false,
  }),
}))
vi.mock("@/ui/Navbar", () => ({ Navbar: () => <nav data-testid="navbar" /> }))
vi.mock("@/shared/components/TokenIcon", () => ({
  TokenIcon: ({ symbol }: { symbol: string }) => <span data-testid={`icon-${symbol}`} />,
}))
vi.mock("@/features/wallet/components/ConnectButton", () => ({
  ConnectButton: () => <button>Connect</button>,
}))
vi.mock("@/features/wallet/components/NetworkMismatchBanner", () => ({
  NetworkMismatchBanner: () => null,
}))
vi.mock("@/features/wallet/hooks/useNetwork", () => ({
  useNetwork: () => ({ mismatch: false, network: "testnet" }),
}))

// ── Helper: extract the Soroban function name from a transaction XDR ──────────
// Mirrors the path used by AssembledTransaction.validateInvokeContractOp
// (stellar-sdk/lib/contract/assembled_transaction.js:610-619).
function tryGetFunctionName(txXdr: string): string {
  try {
    const tx = TransactionBuilder.fromXDR(txXdr, Networks.TESTNET)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const op = tx.operations[0] as any
    if (op?.type !== "invokeHostFunction") return ""
    // op.func is xdr.HostFunction; .value() returns InvokeContractArgs
    return (op.func.value().functionName() as Buffer).toString("utf-8")
  } catch {
    return ""
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("FaucetPage — connected state renders RPC data (#214)", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0 } },
    })

    // Seed connected wallet
    useWalletStore.setState({
      address: fakeWalletAddress,
      walletId: "freighter",
      status: "connected",
      pendingTransactionXdr: null,
      network: "testnet",
    })

    // Prevent real getLedgerEntries calls for account lookup (third-party SDK method)
    vi.spyOn(rpc.Server.prototype, "getAccount").mockResolvedValue(
      new Account(fakeWalletAddress, "0"),
    )

    // Intercept every simulateTransaction call and return an XDR-encoded ScVal
    // whose type matches the contract method's declared return type.
    server.use(
      http.post("https://soroban-testnet.stellar.org", async ({ request }) => {
        const body = (await request.json()) as {
          id?: string | number
          method?: string
          params?: { transaction?: string }
        }

        if (body.method !== "simulateTransaction") {
          return HttpResponse.json({ jsonrpc: "2.0", id: body.id, result: {} })
        }

        const fnName = tryGetFunctionName(body.params?.transaction ?? "")

        let retvalXdr: string
        if (fnName === "claim_amount") {
          retvalXdr = nativeToScVal(CLAIM_AMOUNT_RAW, { type: "i128" }).toXDR("base64")
        } else if (fnName === "balance") {
          retvalXdr = nativeToScVal(BALANCE_RAW, { type: "i128" }).toXDR("base64")
        } else if (fnName === "last_claim_ledger") {
          retvalXdr = nativeToScVal(LAST_CLAIM_LEDGER, { type: "u32" }).toXDR("base64")
        } else {
          // cooldown_ledgers (or any unrecognised function)
          retvalXdr = nativeToScVal(COOLDOWN_LEDGERS, { type: "u32" }).toXDR("base64")
        }

        return HttpResponse.json({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            latestLedger: 1000,
            minResourceFee: "100",
            results: [{ xdr: retvalXdr, auth: [] }],
          },
        })
      }),
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    useWalletStore.setState({
      address: null,
      walletId: null,
      status: "disconnected",
      pendingTransactionXdr: null,
      network: "testnet",
    })
  })

  function renderPage() {
    return render(
      <QueryClientProvider client={queryClient}>
        <FaucetPage />
      </QueryClientProvider>,
    )
  }

  it("renders token balances after data loads", async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText("5 TUSDC")).toBeInTheDocument())
  })

  it("renders claim amounts after data loads", async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText("1 TUSDC")).toBeInTheDocument())
  })

  it("renders cooldown ledger count after data loads", async () => {
    renderPage()
    await waitFor(() =>
      expect(screen.getByText(/100 ledgers between claims/i)).toBeInTheDocument(),
    )
  })

  it("renders last claim ledger text after data loads", async () => {
    renderPage()
    // Component renders "Last claim ledger {n}" once per token card (4 tokens)
    await waitFor(() =>
      expect(screen.getAllByText(/Last claim ledger 999/)).not.toHaveLength(0),
    )
  })
})
