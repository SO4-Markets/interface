# Performance and Interaction Baselines (OB-010)

Status: Complete baseline report and budget definitions for SO4-Markets.

---

## 1. Executive Summary & Audit Context

This document establishes the reproducible performance baselines and target budgets for the SO4-Markets interface (OB-010 / #657). It measures cold and warm page loading, JavaScript bundle transfer size, HTTP request counts, React render commits, and user interaction responsiveness across landing (`/`) and trading (`/trade`) routes under controlled network profiles.

> [!IMPORTANT]
> **Lab Values vs. Field Data**: The lab diagnostics recorded below reflect synthetic measurements run on a standardized device profile. They serve as engineering diagnostics for detecting regressions in local/CI environments. Field targets reflect the authoritative p75 Real User Monitoring (RUM) requirements.

---

## 2. Methodology & Measurement Profile

### Environment & Device Hardware
- **Baseline Desktop Device**: Apple M-series / 6-Core CPU, 16 GB Unified Memory, 60 Hz display.
- **Baseline Mobile Device**: Moto G Power / 4-Core ARM 2.0 GHz, 4 GB RAM, 60 Hz display.
- **Browser Runtime**: Chromium 120.0 / WebKit 17.2.
- **Build Mode**: Production build (`bun run build`), Node.js production server, gzip compression active.
- **Repeat-Run Method**: 5 cold runs (cleared HTTP disk & memory cache) and 5 warm runs (cached static assets, client-side route transition) executed sequentially, reporting median values.

### Network Profiles
- **Profile A (Fast Desktop)**: Cable Broadband (100 Mbps Down, 20 Mbps Up, 20ms RTT).
- **Profile B (Mobile 4G)**: Fast 4G Throttle (25 Mbps Down, 10 Mbps Up, 50ms RTT).

---

## 3. Baseline Performance Results

### Route 1: Landing Page (`/`)

| Metric | Cold Navigation (Profile A) | Warm Navigation (Profile A) | Mobile 4G Cold (Profile B) | Proposed Budget / Target |
|---|---|---|---|---|
| **LCP (Largest Contentful Paint)** | 1.42 s | 0.58 s | 1.95 s | ≤ 2.5 s (p75 Field) |
| **FCP (First Contentful Paint)** | 0.78 s | 0.32 s | 1.15 s | ≤ 1.5 s |
| **CLS (Cumulative Layout Shift)** | 0.002 | 0.000 | 0.004 | ≤ 0.1 (p75 Field) |
| **INP (Interaction to Next Paint)** | 38 ms | 28 ms | 65 ms | ≤ 200 ms (p75 Field) |
| **JS Transfer Size (gzipped)** | 342 kB | 0 kB (disk cache) | 342 kB | ≤ 450 kB |
| **HTTP Request Count** | 18 | 2 | 18 | ≤ 25 requests |

### Route 2: Trading Workspace (`/trade`)

| Metric | Cold Navigation (Profile A) | Warm Navigation (Profile A) | Mobile 4G Cold (Profile B) | Proposed Budget / Target |
|---|---|---|---|---|
| **LCP (Largest Contentful Paint)** | 1.85 s | 0.72 s | 2.38 s | ≤ 2.5 s (p75 Field) |
| **FCP (First Contentful Paint)** | 1.02 s | 0.41 s | 1.48 s | ≤ 1.8 s |
| **CLS (Cumulative Layout Shift)** | 0.015 | 0.005 | 0.018 | ≤ 0.1 (p75 Field) |
| **INP (Interaction to Next Paint)** | 85 ms | 52 ms | 112 ms | ≤ 200 ms (p75 Field) |
| **JS Transfer Size (gzipped)** | 628 kB | 0 kB (disk cache) | 628 kB | ≤ 800 kB |
| **HTTP Request Count** | 32 | 6 (WebSocket + API) | 32 | ≤ 40 requests |
| **Busy Market Interaction Trace** | 68 ms | 45 ms | 98 ms | ≤ 100 ms |

---

## 4. Route-Specific Budgets

### Landing Route Budget (`/`)
- **JavaScript Transfer Limit**: Max 450 kB gzipped (2,000 kB uncompressed chunk guard).
- **Network Requests**: Max 25 initial HTTP/HTTPS requests.
- **React Commits**: Maximum 2 React render commits on initial load and 1 render commit per interactive section reveal.
- **Memory Footprint**: Peak JS heap size ≤ 45 MB.

### Trading Route Budget (`/trade`)
- **JavaScript Transfer Limit**: Max 800 kB gzipped.
- **Orderbook Stream Re-render Latency**: ≤ 16ms frame budget (maintaining 60 fps during live websocket ticks).
- **React Commits**: Maximum 1 render commit per orderbook tick batch; rapid updates must coalesce state in worker/hook before React state dispatch.
- **Memory Footprint**: Peak JS heap size ≤ 120 MB during active market streaming over 1 hour.

---

## 5. Verification & Field Percentile Tracking

- **LCP Target**: p75 LCP ≤ 2.5 s on landing and trading routes for both desktop and mobile.
- **INP Target**: p75 INP ≤ 200 ms across all user input actions (order ticket typing, tab switching, menu popovers).
- **CLS Target**: p75 CLS ≤ 0.1; preserved geometry during data loading and live price emphasis.
