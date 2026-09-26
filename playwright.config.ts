import { defineConfig, devices } from "@playwright/test"

const landingAudit = process.env.PLAYWRIGHT_LANDING_AUDIT === "1"
const recordMotionEvidence = process.env.PLAYWRIGHT_MOTION_EVIDENCE === "1"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
    video: recordMotionEvidence ? "on" : "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /mobile-nav\.spec\.ts/,
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] },
      testMatch: /mobile-nav\.spec\.ts/,
    },
  ],
  webServer: {
    command: landingAudit
      ? "bun run --cwd apps/web build -- --mode testnet && bun run --cwd apps/web preview -- --host 127.0.0.1 --port 3000"
      : "bun run --cwd apps/web dev -- --host 127.0.0.1 --mode testnet",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI && !landingAudit,
    timeout: landingAudit ? 240_000 : 120_000,
  },
})
