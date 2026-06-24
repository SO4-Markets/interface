import { defineConfig, loadEnv } from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import viteTsConfigPaths from "vite-tsconfig-paths"
import tailwindcss from "@tailwindcss/vite"
import { nitro } from "nitro/vite"

export default defineConfig(({ mode }) => {
  // Determine the target network (e.g. "testnet", "mainnet") from VITE_NETWORK
  // or fall back to the Vite mode string.
  const baseEnv = loadEnv(mode, process.cwd(), "VITE_")
  const network = baseEnv.VITE_NETWORK

  // Load network-specific env overrides from .env.{network}
  const networkEnv = loadEnv(network, process.cwd(), "VITE_")

  return {
    define: {
      // freighter-api ships as a webpack UMD bundle that references `self` as the
      // global root. In Node.js SSR context `self` is undefined; alias it to
      // globalThis so the UMD registration doesn't crash the module runner.
      "self": "globalThis",
      "import.meta.env.VITE_NETWORK": JSON.stringify(network),
      ...Object.entries(networkEnv).reduce(
        (acc, [key, val]) => {
          acc[`import.meta.env.${key}`] = JSON.stringify(val)
          return acc
        },
        {} as Record<string, string>,
      ),
    },
    plugins: [
      nitro(),
      viteTsConfigPaths({
        projects: ["./tsconfig.json"],
      }),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
    ],
    // stellar-wallets-kit is ESM but its Freighter module imports named exports
    // from @stellar/freighter-api which ships as CJS. Node's native ESM loader
    // can't always destructure CJS named exports, so we force Vite/Rollup to
    // bundle these packages instead of letting Node load them raw in SSR.
    ssr: {
      noExternal: [
        "@creit.tech/stellar-wallets-kit",
        "@stellar/freighter-api",
      ],
    },
  }
})
