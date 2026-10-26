// Only names infrastructure SO4 actually integrates, per README.md's Tech
// Stack table: Stellar (settlement chain), Soroban (contract platform),
// Binance (primary price feed), GMX oracle (fallback feed). GF3-002's build
// listed "Reflector" and "Blend" here, neither of which appears anywhere
// else in the codebase — no contract address, no integration code, no README
// mention. That was a fabricated claim and is removed rather than repeated.
const SPONSORS = ["Stellar", "Soroban", "Binance", "GMX Oracle"]

export function SponsorsSection() {
  return (
    <section className="border-t-hairline border-gmx-sponsors-border bg-gmx-light-150 px-4 py-20 text-gmx-slate-900 sm:px-10 sm:py-15">
      <div className="mx-auto flex max-w-300 flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-40 font-medium tracking-[-1.28px]">Built on</h2>
          {/* gmx-slate-500 is a dark-surface token — see the same note in
              launch-section.tsx; 2.25:1 here failed WCAG contrast outright. */}
          <p className="mt-1 text-18 font-medium tracking-[-0.576px] text-gmx-slate-900/70">
            Stellar infrastructure, live price data
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SPONSORS.map((name) => (
            <div
              key={name}
              className="flex h-20 items-center justify-center rounded-12 bg-white px-4 text-14 font-medium text-gmx-slate-900"
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
