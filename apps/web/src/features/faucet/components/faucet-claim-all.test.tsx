import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { HttpResponse, http } from "msw"
import { Account, Networks, TransactionBuilder, nativeToScVal, rpc } from "@stellar/stellar-sdk"
import { toast } from "sonner"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import { walletKit } from "@/features/wallet/lib/wallet-kit"
import { server } from "@/test/msw/server"
import { fakeWalletAddress } from "@/test/fakes/wallet"
import { FaucetPage } from "./faucet-page"

// ── Seed values ────────────────────────────────────────────────────────────────
const CLAIM_AMOUNT_RAW = 10_000_000n
const BALANCE_RAW = 50_000_000n
const COOLDOWN_LEDGERS = 100
const LAST_CLAIM_LEDGER = 0

// Precomputed base64-XDR constants:
//   new SorobanDataBuilder().build().toXDR("base64")
const EMPTY_SOROBAN_DATA = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
//   xdr.ScVal.scvVoid().toXDR("base64")
const SCVAL_VOID = "AAAAAQ=="

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

describe("FaucetPage — claim all success flow (#216)", () => {
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

    // Fake signer: echo unsigned XDR back so sendAndPoll can parse it
    vi.spyOn(walletKit, "signTransaction").mockImplementation(async (xdr) => ({
      signedTxXdr: xdr,
    }))

    // Intercept send/poll at the SDK prototype level to avoid building
    // complex resultMetaXdr / envelopeXdr / resultXdr XDR for getTransaction
    vi.spyOn(rpc.Server.prototype, "sendTransaction").mockResolvedValue({
      status: "PENDING",
      hash: "aBulkClaimTestTransactionHash",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    vi.spyOn(rpc.Server.prototype, "getTransaction").mockResolvedValue({
      status: "SUCCESS",
      txHash: "aBulkClaimTestTransactionHash",
      latestLedger: 1001,
      latestLedgerCloseTime: 1_700_000_000,
      returnValue: undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(toast, "loading").mockReturnValue("mock-toast-id" as any)
    vi.spyOn(toast, "success")

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
        } else if (fnName === "claim_many") {
          retvalXdr = SCVAL_VOID
        } else {
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

  it("shows Claiming… state while in flight then fires success toast", async () => {
    const user = userEvent.setup()
    renderPage()

    // Wait for page data to load and bulk button to appear
    const bulkButton = await screen.findByRole("button", { name: "Claim Test Tokens" }, { timeout: 3000 })

    await user.click(bulkButton)

    // isBulkPending → button label changes immediately
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Claiming/i })).toBeInTheDocument(),
    )

    // sendAndPoll sleeps 1 s before first poll — allow up to 5 s
    await waitFor(
      () =>
        expect(toast.success).toHaveBeenCalledWith("Test tokens claimed!", expect.any(Object)),
      { timeout: 5000 },
    )
  })

  it("invalidates faucet query cache after successful bulk claim", async () => {
    const user = userEvent.setup()
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")
    renderPage()

    const bulkButton = await screen.findByRole("button", { name: "Claim Test Tokens" }, { timeout: 3000 })
    await user.click(bulkButton)

    await waitFor(
      () =>
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            queryKey: ["faucet", "data", fakeWalletAddress],
          }),
        ),
      { timeout: 5000 },
    )
  })
})
