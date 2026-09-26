import { Link } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"

/*
 * Order book preview (OB-024).
 *
 * Sample levels, deliberately hard-coded and labelled as sample: the landing
 * page has no verified public feed to draw from, so anything that looked live
 * would be a claim we cannot back. The label is part of the component rather
 * than decoration around it — a reader who scrolls past the caption must still
 * not be able to mistake these numbers for executable liquidity.
 *
 * The tick only moves the sample book. It stops when the document is hidden
 * and when the panel scrolls out of view, and never starts at all under
 * prefers-reduced-motion, which renders the same layout as a static panel.
 */

const LEVELS = [
  { price: "68,412.50", size: "0.418", depth: 34 },
  { price: "68,409.00", size: "1.204", depth: 62 },
  { price: "68,405.50", size: "0.762", depth: 48 },
  { price: "68,401.00", size: "2.310", depth: 88 },
] as const

const SPARK = [12, 18, 15, 22, 19, 26, 24, 31, 28, 34, 30, 37] as const

const TICK_MS = 2600

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReduced(query.matches)
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

  return reduced
}

/** Whether the panel is in the viewport and the page is visible. */
function usePreviewActive() {
  const ref = useRef<HTMLDivElement>(null)
  const [offscreen, setOffscreen] = useState(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element || typeof IntersectionObserver === "undefined") return

    const observer = new IntersectionObserver(
      ([entry]) => setOffscreen(!entry.isIntersecting),
      { threshold: 0.15 }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden)
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [])

  return { ref, active: !offscreen && !hidden }
}

function Sparkline() {
  const points = SPARK.map((value, index) => {
    const x = (index / (SPARK.length - 1)) * 100
    const y = 100 - (value / 40) * 100
    return `${x},${y}`
  }).join(" ")

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="h-24 w-full"
      role="img"
      aria-label="Sample price line for the preview, not live market data"
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-gmx-blue-400)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export function OrderbookPreview() {
  const reducedMotion = useReducedMotion()
  const { ref, active } = usePreviewActive()
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    if (reducedMotion || !active) return

    const timer = setInterval(() => {
      setOffset((current) => (current + 1) % LEVELS.length)
    }, TICK_MS)

    return () => clearInterval(timer)
  }, [reducedMotion, active])

  const levels = LEVELS.map((_, index) => LEVELS[(index + offset) % LEVELS.length])

  return (
    <section className="relative mx-auto w-full max-w-300 px-4 pt-6 pb-16 sm:px-10">
      <div
        ref={ref}
        className="rounded-20 border border-hairline border-gmx-slate-600 bg-gmx-slate-800 p-6 sm:p-9"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-heading-4 text-white">The workspace, at a glance</h2>
          <p className="text-12 text-gmx-slate-400">
            Sample data — not live liquidity, and not tradeable
          </p>
        </div>

        {/* Reserved heights keep this block from shifting the page it sits on. */}
        <div className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex min-h-40 flex-col justify-between rounded-12 border border-hairline border-gmx-slate-600 p-5">
            <p className="text-12 uppercase tracking-[0.864px] text-gmx-slate-500">
              Chart
            </p>
            <Sparkline />
            <p className="text-12 text-gmx-slate-500">Market: BTC / USDC (sample)</p>
          </div>

          <div className="flex min-h-40 flex-col justify-between rounded-12 border border-hairline border-gmx-slate-600 p-5">
            <p className="text-12 uppercase tracking-[0.864px] text-gmx-slate-500">
              Order book
            </p>
            <ul className="flex flex-col gap-2">
              {levels.map((level, index) => (
                <li
                  key={`${level.price}-${index}`}
                  className="motion-safe:transition-transform motion-safe:duration-300"
                >
                  <div className="flex items-center justify-between text-12">
                    <span className="text-gmx-slate-300">{level.price}</span>
                    <span className="text-gmx-slate-400">{level.size}</span>
                  </div>
                  <div className="mt-1 h-1 w-full rounded-8 bg-gmx-slate-700">
                    <div
                      className="h-1 rounded-8 bg-gmx-blue-400 opacity-70"
                      style={{ width: `${level.depth}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex min-h-40 flex-col justify-between rounded-12 border border-hairline border-gmx-slate-600 p-5">
            <p className="text-12 uppercase tracking-[0.864px] text-gmx-slate-500">
              Ticket
            </p>
            <dl className="flex flex-col gap-2 text-12">
              <div className="flex items-center justify-between">
                <dt className="text-gmx-slate-400">Side</dt>
                <dd className="text-gmx-slate-200">Long</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gmx-slate-400">Size</dt>
                <dd className="text-gmx-slate-200">1.000 BTC</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gmx-slate-400">Collateral</dt>
                <dd className="text-gmx-slate-200">USDC from wallet</dd>
              </div>
            </dl>
            <Link
              to="/trade"
              className="btn-landing flex w-full items-center justify-center rounded-8 px-5 py-3 text-14"
            >
              Open the live order book
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
