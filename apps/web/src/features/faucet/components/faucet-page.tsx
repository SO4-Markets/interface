import { Skeleton } from "@workspace/ui/components/skeleton"
import { Button } from "@workspace/ui/components/button"
import { FAUCET_TOKENS } from "../data/tokens"
import { FAUCET_CONTRACT_ID } from "../lib/clients"
import { useFaucetData } from "../hooks/useFaucetData"
import { useClaim } from "../hooks/useClaim"
import type { FaucetTokenConfig } from "../data/tokens"
import type { TokenClaimState } from "../hooks/useClaim"
import { Navbar } from "@/ui/Navbar"
import { TokenIcon } from "@/shared/components/TokenIcon"
import { formatToken } from "@/shared/lib/format"
import { NETWORK } from "@/app/config/network"
import { useWalletStore } from "@/features/wallet/store/wallet-store"
import { useNetwork } from "@/features/wallet/hooks/useNetwork"
import { NetworkMismatchBanner } from "@/features/wallet/components/NetworkMismatchBanner"
import { ConnectButton } from "@/features/wallet/components/ConnectButton"

// ── Token card ────────────────────────────────────────────────────────────────

type TokenCardProps = {
  token: FaucetTokenConfig
  balance: number | undefined
  claimAmount: number | undefined
  lastClaimLedger: number | null | undefined
  cooldownLedgers: number | undefined
  isLoading: boolean
  isPending: boolean
  claimState: TokenClaimState
  isDisabled: boolean
  onClaim: (token: FaucetTokenConfig) => void
}

function TokenCard({
  token,
  balance,
  claimAmount,
  lastClaimLedger,
  cooldownLedgers,
  isLoading,
  isPending,
  claimState,
  isDisabled,
  onClaim,
}: TokenCardProps) {
  const cooldownText =
    lastClaimLedger && cooldownLedgers
      ? `Last claim ledger ${lastClaimLedger.toLocaleString()}`
      : "No claim recorded"
  const claimFeedback =
    claimState.status === "success" || claimState.status === "error"
      ? claimState.message
      : null

  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <TokenIcon symbol={token.symbol.replace(/^T/, "")} size={36} />
        <div>
          <p className="text-sm font-semibold text-foreground">
            {token.symbol}
          </p>
          <p className="text-xs text-muted-foreground">{token.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-muted/40 px-3 py-2.5">
          <p className="mb-0.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            Your balance
          </p>
          {isLoading ? (
            <Skeleton className="mt-1 h-4 w-20" />
          ) : (
            <p className="font-mono text-sm text-foreground">
              {formatToken(balance, token.symbol, { decimals: 4 })}
            </p>
          )}
        </div>

        <div className="rounded-lg bg-muted/40 px-3 py-2.5">
          <p className="mb-0.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            Claim amount
          </p>
          {isLoading ? (
            <Skeleton className="mt-1 h-4 w-16" />
          ) : (
            <p className="font-mono text-sm text-foreground">
              {formatToken(claimAmount, token.symbol, { decimals: 2 })}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-[12px] text-muted-foreground">
          {cooldownText}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="h-8 shrink-0"
          disabled={isDisabled || isPending}
          onClick={() => onClaim(token)}
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Claiming…
            </span>
          ) : (
            "Claim"
          )}
        </Button>
      </div>

      {claimFeedback ? (
        <p
          className={`text-[12px] break-words ${
            claimState.status === "error"
              ? "text-destructive"
              : "text-green-500"
          }`}
        >
          {claimFeedback}
        </p>
      ) : null}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function FaucetPage() {
  const address = useWalletStore((state) => state.address)
  const isConnected = useWalletStore((state) => state.status === "connected")
  const { mismatch } = useNetwork()
  const { data, isLoading } = useFaucetData(address)
  const {
    claim,
    isBulkPending,
    isTokenPending,
    hasPendingTokens,
    getTokenClaimState,
  } = useClaim()

  const isTestnet = NETWORK.name === "testnet"
  const globalClaimDisabled = !isConnected || mismatch
  // Bulk claims include every faucet token, so disable bulk while any token claim is in flight.
  const bulkClaimDisabled =
    globalClaimDisabled || isBulkPending || hasPendingTokens

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <Navbar variant="app" />
      <NetworkMismatchBanner />

      <div className="mx-auto w-full max-w-2xl px-4 pt-8 pb-16 sm:px-6">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-semibold tracking-tight">
              Testnet Faucet
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-0.5 text-[11px] font-medium text-yellow-600 dark:text-yellow-400">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
              Stellar Testnet
            </span>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Claim test tokens to try trading on SO4. Tokens have no real value.
          </p>
        </header>

        {!isTestnet ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              The faucet is only available on the Stellar testnet.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Token cards */}
            <div className="grid gap-4 sm:grid-cols-2">
              {FAUCET_TOKENS.map((token) => (
                <TokenCard
                  key={token.symbol}
                  token={token}
                  balance={data?.balances[token.symbol]}
                  claimAmount={data?.claimAmounts[token.symbol]}
                  lastClaimLedger={data?.lastClaimLedgers[token.symbol]}
                  cooldownLedgers={data?.cooldownLedgers}
                  isLoading={isLoading}
                  isPending={isTokenPending(token.contractId)}
                  claimState={getTokenClaimState(token.contractId)}
                  isDisabled={globalClaimDisabled}
                  onClaim={(selectedToken) => claim([selectedToken.contractId])}
                />
              ))}
            </div>

            {/* Claim panel */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Claim test tokens
                  </p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    Receive TUSDC, TWBTC, TETH, and TXLM in a single
                    transaction. A cooldown applies between claims.
                  </p>
                </div>

                {mismatch && (
                  <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-600 dark:text-yellow-400">
                    Switch your wallet to Stellar Testnet to claim.
                  </div>
                )}

                {!isConnected ? (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-[13px] text-muted-foreground">
                      Connect your wallet to claim test tokens.
                    </p>
                    <ConnectButton />
                  </div>
                ) : (
                  <Button
                    variant="default"
                    className="w-full"
                    disabled={bulkClaimDisabled}
                    onClick={() => claim()}
                  >
                    {isBulkPending ? (
                      <span className="flex items-center gap-2">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Claiming…
                      </span>
                    ) : (
                      "Claim Test Tokens"
                    )}
                  </Button>
                )}

                {data?.cooldownLedgers != null && data.cooldownLedgers > 0 && (
                  <p className="text-center text-[12px] text-muted-foreground">
                    Cooldown: {data.cooldownLedgers.toLocaleString()} ledgers
                    between claims
                  </p>
                )}
              </div>
            </div>

            {/* Info panel */}
            <div className="rounded-xl border border-border bg-muted/20 px-5 py-4">
              <p className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Contract addresses
              </p>
              <dl className="space-y-1.5">
                {[
                  { label: "Faucet", id: FAUCET_CONTRACT_ID },
                  ...FAUCET_TOKENS.map((token) => ({
                    label: token.symbol,
                    id: token.contractId,
                  })),
                ].map(({ label, id }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-3"
                  >
                    <dt className="w-12 shrink-0 text-[12px] text-muted-foreground">
                      {label}
                    </dt>
                    <dd className="min-w-0 truncate font-mono text-[11px] text-foreground/70">
                      {id}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
