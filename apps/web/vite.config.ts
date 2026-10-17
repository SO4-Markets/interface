import { defineConfig, loadEnv } from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import viteTsConfigPaths from "vite-tsconfig-paths"
import tailwindcss from "@tailwindcss/vite"
import { nitro } from "nitro/vite"

function resolveNetwork(baseEnv: Record<string, string>): string {
  const network = baseEnv.VITE_NETWORK || "testnet"
  const validNetworks = ["testnet", "mainnet"]
  if (!validNetworks.includes(network)) {
    throw new Error(`Invalid VITE_NETWORK: "${network}". Must be one of: ${validNetworks.join(", ")}`)
  }
  return network
}

function bundleSizeGuard(limitKb: number) {
  return {
    name: "bundle-size-guard",
    enforce: "post" as const,
    generateBundle(_options: any, bundle: any) {
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if ((chunk as any).type === "chunk") {
          const sizeKb = (chunk as any).code.length / 1024;
          if (sizeKb > limitKb) {
            throw new Error(`\n[bundle-size-guard] Bundle size budget exceeded!\nChunk "${fileName}" is ${sizeKb.toFixed(2)} KB (budget is ${limitKb} KB).\n\nTo update the budget intentionally, modify the 'bundleSizeGuard' limit in 'vite.config.ts'.\n`);
          }
        }
      }
    }
  }
}

export default defineConfig(({ mode }) => {
  // Determine the target network (e.g. "testnet", "mainnet") from VITE_NETWORK
  // or default to "testnet". Invalid values are rejected.
  const baseEnv = loadEnv(mode, process.cwd(), "VITE_")
  const network = resolveNetwork(baseEnv)

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
      bundleSizeGuard(2000), // Budget: 2000 KB per chunk max
    ],
    // stellar-wallets-kit is ESM but its Freighter module imports named exports
    // from @stellar/freighter-api which ships as CJS. Node's native ESM loader
    // can't always destructure CJS named exports, so we force Vite/Rollup to
    // bundle these packages instead of letting Node load them raw in SSR.
    build: {
      rollupOptions: {
        external: ["@twind/core"],
      },
    },
    ssr: {
      noExternal: [
        "@creit.tech/stellar-wallets-kit",
        "@stellar/freighter-api",
      ],
    },
  }
})
