import type { OhlcBar } from "./oracle"

export type LiveBarUpdate = {
  current: OhlcBar
  bars: Array<OhlcBar>
  source: "stream" | "poll" | "backfill"
}

export const PERIOD_SECONDS: Record<string, number> = {
  "1m": 60,
  "5m": 5 * 60,
  "15m": 15 * 60,
  "1h": 60 * 60,
  "4h": 4 * 60 * 60,
  "1D": 24 * 60 * 60,
}

/** Maps any event timestamp into the opening timestamp of its candle. */
export function candleTime(timestampSeconds: number, period: string): number {
  const interval = PERIOD_SECONDS[period]
  if (!interval || !Number.isFinite(timestampSeconds)) return timestampSeconds
  return Math.floor(timestampSeconds / interval) * interval
}

/**
 * History and streams can overlap, and reconnects can deliver older events.
 * Keep one canonical bar per opening time; the newest observation wins.
 */
export function mergeBars(
  history: Array<OhlcBar>,
  updates: Array<OhlcBar>,
): Array<OhlcBar> {
  const byTime = new Map<number, OhlcBar>()
  for (const bar of history) byTime.set(bar.time, bar)
  for (const bar of updates) byTime.set(bar.time, bar)
  return [...byTime.values()].sort((a, b) => a.time - b.time)
}

export function canIncrementallyApply(
  previous: Array<OhlcBar>,
  updates: Array<OhlcBar>,
  period: string,
): boolean {
  const lastTime = previous.at(-1)?.time
  if (lastTime === undefined) return false
  if (updates.some((bar) => bar.time < lastTime)) return false

  const interval = PERIOD_SECONDS[period]
  if (interval === undefined) return true

  let expected = lastTime
  for (const time of [...new Set(updates.map((bar) => bar.time))].sort((a, b) => a - b)) {
    if (time <= lastTime) continue
    if (time !== expected + interval) return false
    expected = time
  }
  return true
}

export function parseStreamBar(
  raw: { t: number; o: string; h: string; l: string; c: string; v?: string },
  period: string,
): OhlcBar | null {
  const values = [Number(raw.o), Number(raw.h), Number(raw.l), Number(raw.c)]
  const volume = raw.v === undefined ? undefined : Number(raw.v)
  if (
    !Number.isFinite(raw.t) ||
    values.some((value) => !Number.isFinite(value)) ||
    (volume !== undefined && !Number.isFinite(volume))
  ) return null
  return {
    time: candleTime(Math.floor(raw.t / 1000), period),
    open: values[0],
    high: values[1],
    low: values[2],
    close: values[3],
    ...(volume === undefined ? {} : { volume }),
  }
}
