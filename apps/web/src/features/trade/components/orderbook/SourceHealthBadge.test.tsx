/**
 * OB-058: SourceHealthBadge component tests.
 *
 * Verifies visual indicators for all health states.
 */

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { SourceHealthBadge } from "./SourceHealthBadge"
import type { SourceHealth } from "../../hooks/useSourceHealth"

describe("SourceHealthBadge", () => {
  it("renders initial-load state with connecting indicator", () => {
    const health: SourceHealth = {
      status: "initial-load",
      lastUpdateTime: null,
      staleDuration: null,
      reconnectAttempt: 0,
      isExecutable: false,
      message: "Connecting to market data feed…",
    }

    render(<SourceHealthBadge health={health} />)
    expect(screen.getByText("Connecting…")).toBeInTheDocument()
  })

  it("renders empty-venue state", () => {
    const health: SourceHealth = {
      status: "empty-venue",
      lastUpdateTime: null,
      staleDuration: null,
      reconnectAttempt: 0,
      isExecutable: false,
      message: "Connected — no executable depth available",
    }

    render(<SourceHealthBadge health={health} />)
    expect(screen.getByText("No Depth")).toBeInTheDocument()
  })

  it("renders connected state with live indicator", () => {
    const health: SourceHealth = {
      status: "connected",
      lastUpdateTime: Date.now(),
      staleDuration: null,
      reconnectAttempt: 0,
      isExecutable: true,
      message: "Live market data",
    }

    render(<SourceHealthBadge health={health} />)
    expect(screen.getByText("Live")).toBeInTheDocument()
  })

  it("renders stale state with duration", () => {
    const health: SourceHealth = {
      status: "stale",
      lastUpdateTime: Date.now() - 65000,
      staleDuration: 65000,
      reconnectAttempt: 0,
      isExecutable: false,
      message: "Connection lost — showing last known data",
    }

    render(<SourceHealthBadge health={health} />)
    expect(screen.getByText("Stale")).toBeInTheDocument()
    expect(screen.getByText(/\(1m ago\)/)).toBeInTheDocument()
  })

  it("does not show duration for recent stale data", () => {
    const health: SourceHealth = {
      status: "stale",
      lastUpdateTime: Date.now() - 3000,
      staleDuration: 3000,
      reconnectAttempt: 0,
      isExecutable: false,
      message: "Connection lost — showing last known data",
    }

    render(<SourceHealthBadge health={health} />)
    expect(screen.getByText("Stale")).toBeInTheDocument()
    expect(screen.queryByText(/ago/)).not.toBeInTheDocument()
  })

  it("renders reconnecting state", () => {
    const health: SourceHealth = {
      status: "reconnecting",
      lastUpdateTime: Date.now() - 5000,
      staleDuration: 5000,
      reconnectAttempt: 2,
      isExecutable: false,
      message: "Reconnecting (attempt 2)…",
    }

    render(<SourceHealthBadge health={health} />)
    expect(screen.getByText("Reconnecting…")).toBeInTheDocument()
  })

  it("renders rate-limited state", () => {
    const health: SourceHealth = {
      status: "rate-limited",
      lastUpdateTime: Date.now() - 10000,
      staleDuration: 10000,
      reconnectAttempt: 3,
      isExecutable: false,
      message: "Rate limited — backing off…",
    }

    render(<SourceHealthBadge health={health} />)
    expect(screen.getByText("Rate Limited")).toBeInTheDocument()
  })

  it("renders revision-gap state", () => {
    const health: SourceHealth = {
      status: "revision-gap",
      lastUpdateTime: Date.now() - 2000,
      staleDuration: 2000,
      reconnectAttempt: 1,
      isExecutable: false,
      message: "Resyncing — detected data gap",
    }

    render(<SourceHealthBadge health={health} />)
    expect(screen.getByText("Resyncing…")).toBeInTheDocument()
  })

  it("renders error state", () => {
    const health: SourceHealth = {
      status: "error",
      lastUpdateTime: null,
      staleDuration: null,
      reconnectAttempt: 5,
      isExecutable: false,
      message: "Feed error — unable to connect",
    }

    render(<SourceHealthBadge health={health} />)
    expect(screen.getByText("Error")).toBeInTheDocument()
  })

  it("includes message as title attribute", () => {
    const health: SourceHealth = {
      status: "connected",
      lastUpdateTime: Date.now(),
      staleDuration: null,
      reconnectAttempt: 0,
      isExecutable: true,
      message: "Live market data",
    }

    const { container } = render(<SourceHealthBadge health={health} />)
    const badge = container.querySelector('span[title]')
    expect(badge).toHaveAttribute("title", "Live market data")
  })
})
