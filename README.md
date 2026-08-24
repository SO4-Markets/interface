# SO4 Market

**On-chain perpetual markets, settled on Stellar.**

SO4 is a unified-liquidity perpetuals DEX built on Stellar/Soroban. Deep order books, sub-second matching, and self-custodied risk — built for traders who care where their fills come from.

---

## Screenshots

| Landing | Trade |
|---|---|
| ![Landing page](./screenshots/landing.png) | ![Trade page](./screenshots/trade.png) |

| Earn | Referrals |
|---|---|
| ![Earn page](./screenshots/earn.png) | ![Referrals page](./screenshots/referrals.png) |

---

## Table of Contents

- [Overview](#overview)
- [Screenshots](#screenshots)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Testing Guide](#testing-guide)
- [Architecture](#architecture)
- [Contributing](#contributing) — see also [`CONTRIBUTING.md`](./CONTRIBUTING.md) and [`AGENTS.md`](./AGENTS.md)
- [License](#license)

---

## Overview

SO4 Market is the front-end interface for the SO4 perpetuals protocol. It connects to Stellar Soroban smart contracts (ExchangeRouter, DataStore, SyntheticsReader, OrderVault) and streams live prices from Binance (primary) with GMX oracle as automatic fallback.

> **Status:** Active development. On-chain contract integration is in progress — the current build uses mock transactions with real UI and live price feeds.

---

## Features

| Area | Details |
|---|---|
| **Trade** | Long / Short / Swap with Market, Limit, and Trigger order types |
| **Chart** | Candlestick chart (lightweight-charts v5), live price updates, position entry & liquidation price lines, dark/light theme |
| **Positions** | Real-time positions, orders, trades, and claims tabs |
| **Earn** | Portfolio overview, pool discovery, additional opportunities, reward distributions |
| **Referrals** | Trader discount codes, affiliate tiers, commission distributions |
| **Landing** | Live market ticker, order book preview, protocol stats |
| **Theme** | Full dark / light mode with zero flash on load |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | [Turborepo](https://turbo.build) + [Bun](https://bun.sh) workspaces |
| Framework | [React 19](https://react.dev) + [Vite 7](https://vitejs.dev) |
| Routing | [TanStack Router v1](https://tanstack.com/router) |
| Server state | [TanStack Query v5](https://tanstack.com/query) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) |
| UI components | [shadcn/ui](https://ui.shadcn.com) (via `packages/ui` workspace) |
| Charts | [lightweight-charts v5](https://tradingview.github.io/lightweight-charts/) |
| Notifications | [Sonner](https://sonner.emilkowal.ski) |
| Blockchain | [Stellar](https://stellar.org) / [Soroban](https://soroban.stellar.org) |
| Oracle | Binance REST (primary) · GMX oracle (fallback) |
| Type safety | TypeScript 5.9 |

---

## Project Structure

```
so4-market/
├── apps/
│   └── web/                        # Main React/Vite application
│       ├── public/                 # Static assets (favicon, manifest, PWA icons)
│       ├── scripts/                # Build-time utilities
│       └── src/
│           ├── features/
│           │   ├── earn/           # Earn page — pools, portfolio, rewards
│           │   ├── referrals/      # Referrals — traders, affiliates, distributions
│           │   └── trade/          # Trade page — chart, order panel, positions
│           ├── routes/             # TanStack Router file-based routes
│           ├── styles/             # Global CSS (landing)
│           └── ui/                 # Shared UI — Navbar, ThemeProvider, landing sections
│
├── packages/
│   └── ui/                         # Shared component library (shadcn/ui)
│       └── src/
│           ├── components/         # Button, Input, Dialog, Tabs, Skeleton, …
│           ├── hooks/
│           ├── lib/
│           └── styles/
│               └── globals.css     # Tailwind base + CSS custom properties
│
├── turbo.json                      # Turborepo pipeline config
├── package.json                    # Root workspace manifest
├── tsconfig.json                   # Root TypeScript config
└── bun.lock
```

### Feature module layout

Each feature under `src/features/<name>/` follows the same convention:

```
<feature>/
├── components/     # React components (page + sub-components)
├── data/           # Static data / contract address constants
├── hooks/          # TanStack Query hooks (data fetching + mutations)
└── lib/            # Business logic, contract calls, type definitions
```

---

## Getting Started

### Prerequisites

| Tool | Version |
|---|---|
| [Bun](https://bun.sh) | ≥ 1.3 |
| [Node.js](https://nodejs.org) | ≥ 20 |

### Installation

```bash
# Clone the repository
git clone https://github.com/SO4-Markets/so4-monorepo.git
cd so4-monorepo

# Install all workspace dependencies
bun install
```

### Full local stack (contracts + indexer + web)

If you need the indexer and contracts running against the web app:

```bash
# Generate indexer types and build (src/types is gitignored)
bun run --cwd apps/s03-indexer codegen
bun run --cwd apps/s03-indexer build

# Sync the contract manifest from a local contracts checkout
SO4_CONTRACTS_REPO=/path/to/contracts \
  bun run --cwd apps/s03-indexer sync:contracts:local

# Start the indexer stack (requires Docker)
bun run --cwd apps/s03-indexer start
```

Run `bun run check:integration` before pushing to mirror the CI matrix.

### Running the development server

```bash
# Start all apps in watch mode
bun dev

# Or start only the web app
cd apps/web && bun dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### Building for production

```bash
bun build
```

Output is written to `apps/web/.output/`.

---

## Available Scripts

Run any of these from the **repository root**:

| Command | Description |
|---|---|
| `bun dev` | Start all packages in development mode |
| `bun build` | Build all packages for production |
| `bun lint` | Lint all packages with ESLint |
| `bun format` | Format all files with Prettier |
| `bun typecheck` | Run TypeScript type checks across all packages |

## Testing Guide

From a clean checkout, install workspace dependencies once:

```bash
bun install --frozen-lockfile
```

Run every unit suite from the repository root:

```bash
bun run test          # all workspaces
bun run test:e2e      # Playwright
```

Or a single workspace:

```bash
bun run --cwd packages/contracts test
bun run --cwd packages/ui test
bun run --cwd apps/s03-indexer test
```

Generate the CI coverage reports locally with `bun run test:coverage`.
`packages/contracts` gates at 85% lines, 85% branches, 80% statements, and 65%
functions. Reports are written to each package's `coverage/` directory.

> **Note:** `apps/web` has an extensive suite under `src/**/*.test.tsx` that is
> not yet wired into `turbo test`. Run it directly with
> `bunx vitest run --cwd apps/web` — some suites are currently failing and are
> being fixed before the package is added to the CI test task.

The end-to-end suite uses Playwright. On a fresh machine, Playwright may need
browser binaries or OS-level system dependencies before `bun run test:e2e` can
launch browsers. If Playwright reports missing dependencies, install them with
the Playwright CLI through Bun:

```bash
bunx playwright install --with-deps
```

Web tests run with MSW enabled and `onUnhandledRequest: "error"`, so every
network request made by a test must have an explicit mock handler. Add shared
handlers in `apps/web/test/msw/handlers.ts` or test-specific handlers with
`server.use(...)`. Tests must not depend on real external network calls.

---

## Architecture

### Oracle / Price feeds

Live candle data and token prices are fetched from the Binance public REST API. If Binance is unavailable or rate-limited, the oracle module automatically retries against the GMX oracle endpoint. Both sources are normalised into a shared `OhlcBar` type (oldest-first, prices as numbers, time in Unix seconds).

### Contract integration

The `lib/stellar.ts`, `lib/earn.ts`, and `lib/referrals.ts` files define the full contract call surface. Each function is currently a **stub** that simulates latency and shows a toast — the real Stellar SDK + Soroban RPC calls are documented inline with `TODO` comments. Contracts to integrate:

- `ExchangeRouter` — `createOrder` (increase / decrease / swap)
- `DataStore` — on-chain key-value protocol config
- `SyntheticsReader` — `getMarketInfo`, `getPositionInfo`, `getOrderInfo` (batched)
- `OrderVault` — holds collateral between order creation and execution
- `StakingRouter` — `stakeSO4`, `unstakeSO4`
- `ReferralsRouter` — `setTraderReferralCodeByUser`, `registerCode`

### Theme system

The theme provider writes `dark` or `light` as a class on `<html>`. A blocking inline script in `<head>` reads `localStorage` before first paint to prevent flash of wrong theme. The chart component uses a `MutationObserver` on `document.documentElement` to re-apply color options instantly when the class changes.

---

## Contributing

Contributions are welcome. **Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) before
opening a pull request** — it covers setup, the quality gate every change must
pass, commit conventions, and the project-specific gotchas that cause most CI
failures.

The short version: before you commit, all of these must pass from the repo root.

```bash
bun lint
bun typecheck
bun run check:tokens
bun run test
bun run test:coverage
bun run build
```

Never disable a check, skip a test, or lower a threshold to make the pipeline
green — fix the underlying cause instead.

### Using an AI coding agent?

[`AGENTS.md`](./AGENTS.md) is the binding operating contract for AI agents in
this repository, enforcing the same gate. Point your tool at it.
([`CLAUDE.md`](./CLAUDE.md) forwards to it for Claude Code.)

### Reporting issues

Open an issue on GitHub with a clear title, steps to reproduce, expected vs
actual behaviour, and the failing command's output. For suspected security
vulnerabilities, contact the maintainers privately instead of filing publicly.

---

## License

```
MIT License

Copyright (c) 2026 so4 labs

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

<p align="center">
  Built by <a href="https://so4.market">so4 labs</a> ·
  <a href="https://twitter.com/so4market">@so4market</a>
</p>


## Developer Reference #611
Resolves issue #611: DX-099: Write /reference/glossary.
