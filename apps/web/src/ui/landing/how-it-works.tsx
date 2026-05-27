const STEPS = [
  {
    num: "/ 01",
    title: "Connect",
    body: "Bring any EVM or Solana wallet. We verify the signature locally; no email, no password, no recovery flow to fail you.",
    lines: [
      { text: "$ ", accent: "so4", rest: " connect --wallet metamask" },
      { text: "→ signing nonce…" },
      { text: "→ ", ok: "verified", rest: " 0x4a...c19f" },
      { text: "▸ session opened" },
    ],
  },
  {
    num: "/ 02",
    title: "Deposit",
    body: "Move USDC into your margin account in a single transaction. Pull it back out the moment a position closes — no withdrawal queues.",
    lines: [
      { text: "▸ deposit 5,000.00 USDC" },
      { text: "→ tx 0x18a2…", accent: "e4f0" },
      { text: "→ ", ok: "confirmed", rest: " in 1 block" },
      { text: "▸ collateral active" },
    ],
  },
  {
    num: "/ 03",
    title: "Trade",
    body: "Limit, market, stop, scaled — one click hits the book. Fills are signed and settled the same block they're placed.",
    lines: [
      { text: "▸ long BTC-PERP 0.4 @ mkt" },
      { text: "→ filled 0.4 @ 67,218.40" },
      { text: "→ funding -0.0098% / 1h" },
      { text: "", ok: "▸ position open" },
    ],
  },
]

type TermLine = {
  text?: string
  accent?: string
  rest?: string
  ok?: string
}

function Terminal({ lines }: { lines: Array<TermLine> }) {
  return (
    <div className="font-mono-num mt-6 h-[90px] overflow-hidden border border-border bg-muted/20 p-3.5 text-[11px] text-muted-foreground">
      {lines.map((line, i) => (
        <div key={i} className="leading-[1.7]">
          {line.text}
          {line.accent && <span className="text-primary">{line.accent}</span>}
          {line.rest}
          {line.ok && <span className="text-emerald-400">{line.ok}</span>}
        </div>
      ))}
    </div>
  )
}

export function HowItWorks() {
  return (
    <section className="px-4 pb-24 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1320px]">
        <div className="mb-12">
          <div className="font-mono-num mb-4 flex items-center gap-2.5 text-[11.5px] uppercase tracking-[0.18em] text-primary">
            <span className="inline-block h-px w-4 bg-primary" />
            Flow
          </div>
          <h2
            className="font-trading font-medium leading-[1.04] tracking-[-0.025em] text-foreground"
            style={{ fontSize: "clamp(34px, 3.4vw, 46px)" }}
          >
            From wallet to fill in{" "}
            <span className="italic font-normal text-primary">three steps.</span>
          </h2>
          <p className="mt-4 max-w-[560px] text-[16px] leading-[1.55] text-muted-foreground">
            No KYC, no email, no signup form. Connect a wallet and the orderbook is
            open — your collateral never leaves your control.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map(({ num, title, body, lines }) => (
            <div key={num} className="relative border border-border bg-card p-8">
              <div className="font-mono-num text-[11px] uppercase tracking-[0.18em] text-primary">
                {num}
              </div>
              <h3 className="mt-7 text-[22px] font-medium tracking-[-0.02em] text-foreground">
                {title}
              </h3>
              <p className="mt-3 text-[14px] leading-[1.55] text-muted-foreground">{body}</p>
              <Terminal lines={lines} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
