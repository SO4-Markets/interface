import { DistributionsTable, type DistributionRow } from "./distributions-table"

// TODO: Replace with live data fetched from Stellar event log or subgraph:
//   - Query RewardsDistributor.Distribute events for connected account
//   - Paginate by epoch (weekly snapshots stored in DataStore)
//   - Fields: epochId, timestamp, tokenAmount, tokenAddress, txHash
const MOCK_DISTRIBUTIONS: DistributionRow[] = []

function InfoCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-2 text-[13px] font-semibold">Fee Distribution Schedule</h3>
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        Protocol fees are collected continuously and distributed weekly to SO4 stakers and
        liquidity providers. Your share is proportional to your staking power (staked amount ×
        duration multiplier). USDC fees are distributed directly; platform fees are used for
        buybacks and distributed as esSO4.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Distribution cycle", value: "Weekly" },
          { label: "Fee allocation", value: "70% to stakers" },
          { label: "Remaining", value: "27% Treasury" },
          { label: "Protocol", value: "3% team" },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-[10px] text-muted-foreground">{label}</p>
            <p className="mt-0.5 text-[12px] font-medium">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DistributionsTab() {
  return (
    <div className="space-y-4">
      <InfoCard />

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="border-b border-border px-5 py-3.5">
          <h3 className="text-[13px] font-semibold">Distribution History</h3>
        </div>
        <DistributionsTable distributions={MOCK_DISTRIBUTIONS} />
      </div>
    </div>
  )
}
