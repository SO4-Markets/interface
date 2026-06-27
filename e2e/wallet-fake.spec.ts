import { expect, test } from "@playwright/test"
import { fakeWalletAddress } from "../apps/web/test/fakes/wallet"

// Seeds a fixed, connected wallet address via the app's dev-only test hook
// (window.__SO4_TEST_WALLET__, added in apps/web/src/app/providers/index.tsx)
// instead of a real Freighter / Stellar Wallets Kit extension.
//
// The hook is only attached once the app's React tree mounts, so it can't be
// set up via Playwright's addInitScript (which runs before any of the page's
// own JS) — we navigate first, wait for the hook to exist, then call it.
// The network is already fixed by the running dev server's env config
// (testnet by default), so no per-test network override is needed.

test("connected wallet UI appears after seeding a fake wallet", async ({ page }) => {
  await page.goto("/faucet")

  await page.waitForFunction(() => "__SO4_TEST_WALLET__" in window)

  await page.evaluate((address) => {
    ;(window as unknown as { __SO4_TEST_WALLET__: { connect: (a: string) => void } })
      .__SO4_TEST_WALLET__.connect(address)
  }, fakeWalletAddress)

  // Connected wallet pill (formatted "GAAAAA…AWHF") replaces "Connect Wallet"
  await expect(page.getByRole("button", { name: /connected wallet/i }).first()).toBeVisible()
  await expect(page.getByText("GAAAAA…AWHF").first()).toBeVisible()

  // The faucet's claim panel switches from the connect prompt to the bulk
  // claim action once a wallet is connected.
  await expect(page.getByRole("button", { name: "Claim Test Tokens" })).toBeVisible()
  await expect(page.getByText("Connect your wallet to claim test tokens.")).not.toBeVisible()
})