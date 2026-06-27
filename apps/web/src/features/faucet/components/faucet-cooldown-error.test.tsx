import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { HttpResponse, http } from "msw"
import { Account, Networks, TransactionBuilder, nativeToScVal, rpc } from "@stellar/stellar-sdk"
import { toast } from "sonner"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import { server } from "@/test/msw/server"
import { fakeWalletAddress } from "@/test/fakes/wallet"
import { FaucetPage } from "./faucet-page"

// ── Seed values for useFaucetData read calls ───────────────────────────────────
const CLAIM_AMOUNT_RAW = 10_000_000n
const BALANCE_RAW = 50_000_000n
const COOLDOWN_LEDGERS = 100
const LAST_CLAIM_LEDGER = 0

// Precomputed: new SorobanDataBuilder().build().toXDR("base64")
const EMPTY_SOROBAN_DATA = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="

// ── UI-only mocks — useClaim and useFaucetData are left real ──────────────────
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

function tryGetFunctionName(txXdr: string): string {
  try {
    const tx = TransactionBuilder.fromXDR(txXdr, Networks.TESTNET)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const op = tx.operations[0] as any
    if (op?.type !== "invokeHostFunction") return ""
    return (op.func.value().functionName() as Buffer).toString("utf-8")
  } catch {
    return ""
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("FaucetPage — cooldown failure flow (#217)", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0 } },
    })

    useWalletStore.setState({
      address: fakeWalletAddress,
      walletId: "freighter",
      status: "connected",
      pendingTransactionXdr: null,
      network: "testnet",
    })

    vi.spyOn(rpc.Server.prototype, "getAccount").mockResolvedValue(
      new Account(fakeWalletAddress, "0"),
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(toast, "loading").mockReturnValue("mock-toast-id" as any)
    vi.spyOn(toast, "error")

    // MSW handler:
    //  - claim_many → contract error "Error(Contract, #6)"
    //    The SDK's AssembledTransaction.simulationData getter sees
    //    Api.isSimulationError(sim) === true and throws:
    //    SimulationFailed: Transaction simulation failed: "Error(Contract, #6)"
    //    useClaim.isClaimTooSoonError matches via /error\(contract,\s*#6\)/i.
    //  - all other simulate calls → normal success responses (for page load)
    //  - no sendTransaction / getTransaction calls are made; the error is
    //    thrown during simulation so signing and submission never occur.
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

        if (fnName === "claim_many") {
          return HttpResponse.json({
            jsonrpc: "2.0",
            id: body.id,
            result: {
              error: "Error(Contract, #6)",
              latestLedger: 1000,
            },
          })
        }

        // Read-only calls needed for page load
        let retvalXdr: string
        if (fnName === "claim_amount") {
          retvalXdr = nativeToScVal(CLAIM_AMOUNT_RAW, { type: "i128" }).toXDR("base64")
        } else if (fnName === "balance") {
          retvalXdr = nativeToScVal(BALANCE_RAW, { type: "i128" }).toXDR("base64")
        } else if (fnName === "last_claim_ledger") {
          retvalXdr = nativeToScVal(LAST_CLAIM_LEDGER, { type: "u32" }).toXDR("base64")
        } else {
          // cooldown_ledgers
          retvalXdr = nativeToScVal(COOLDOWN_LEDGERS, { type: "u32" }).toXDR("base64")
        }

        return HttpResponse.json({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            latestLedger: 1000,
            minResourceFee: "100",
            transactionData: EMPTY_SOROBAN_DATA,
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

  it("shows cooldown error toast after single token claim", async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(
      () => expect(screen.getAllByRole("button", { name: "Claim" })[0]).toBeInTheDocument(),
      { timeout: 3000 },
    )

    await user.click(screen.getAllByRole("button", { name: "Claim" })[0])

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Cooldown active — please wait before claiming again.",
        expect.any(Object),
      ),
    )
  })

  it("shows cooldown error toast after bulk claim", async () => {
    const user = userEvent.setup()
    renderPage()

    const bulkButton = await screen.findByRole(
      "button",
      { name: "Claim Test Tokens" },
      { timeout: 3000 },
    )

    await user.click(bulkButton)

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Cooldown active — please wait before claiming again.",
        expect.any(Object),
      ),
    )
  })
})
