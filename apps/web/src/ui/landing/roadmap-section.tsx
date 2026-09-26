import { Quarter } from "./quarter"
import type { QuarterData } from "./quarter"

// No dated roadmap exists in the repo — GMX's quarter labels (Q1..Q4) imply
// specific committed dates, which would be a fabricated public promise if
// applied here. Stage labels instead, and every item is checked against real
// repo state rather than adapted from GMX's own roadmap:
// - "Testnet, mock fills" / "Live price feeds": true today (README.md status
//   line: "mock transactions with real UI and live price feeds").
// - "Contract integration": explicitly "in progress" per the same line.
// - "Referrals live": true — apps/web/src/features/referrals exists and ships.
// - "Staking, GLV vesting": apps/web/src/app/config/contracts.ts marks
//   stakingRouter/glvRouter/vestingRouter as real but optional contract slots
//   ("will be an empty string when not yet deployed") — a genuine, sourced
//   next step, not invented.
// TODO(GF3-003): maintainer to confirm target dates/quarters once set.
const QUARTERS: Array<QuarterData> = [
  {
    label: "Shipped",
    items: [
      { text: "Testnet, mock fills", completed: true },
      { text: "Live price feeds", completed: true },
      { text: "Referrals live", completed: true },
    ],
    lastCompleted: true,
  },
  {
    label: "In progress",
    items: [
      { text: "Contract integration", completed: false },
    ],
  },
  {
    label: "Next",
    items: [
      { text: "Mainnet launch", completed: false },
      { text: "Staking, GLV vesting", completed: false },
    ],
  },
]

export function RoadmapSection() {
  return (
    <section className="bg-gmx-slate-900 px-4 pb-20 sm:px-10 sm:pb-30">
      <div className="mx-auto max-w-300">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-heading-2 text-white">Roadmap</h2>
          {/* No dev-plan writeup exists yet — links to the source repo,
              a real destination, rather than a dead "#" anchor. */}
          <a
            href="https://github.com/Levee-HQ/interface"
            target="_blank"
            rel="noreferrer"
            className="btn-landing hidden shrink-0 rounded-8 px-4 py-2.5 text-14 sm:inline-flex"
          >
            Read more
          </a>
        </div>

        {/* tabIndex makes the horizontal scroller reachable by keyboard —
            a scroll container is only arrow-key scrollable once focused,
            and without this the roadmap is unreachable without a pointer.
            role/aria-label give it a name in the a11y tree now that it is
            a focus stop. */}
        <div
          className="mt-9 flex gap-6 overflow-x-scroll scrollbar-hide focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gmx-blue-400"
          tabIndex={0}
          role="group"
          aria-label="Roadmap timeline, scrollable horizontally"
        >
          {QUARTERS.map((q) => (
            <Quarter key={q.label} {...q} />
          ))}
        </div>

        <a
          href="https://github.com/Levee-HQ/interface"
          target="_blank"
          rel="noreferrer"
          className="btn-landing mt-6 flex w-full items-center justify-center rounded-8 px-4 py-2.5 text-14 sm:hidden"
        >
          Read more
        </a>
      </div>
    </section>
  )
}
