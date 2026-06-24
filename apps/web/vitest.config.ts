import { mergeConfig, defineConfig } from "vitest/config"
import viteTsConfigPaths from "vite-tsconfig-paths"
import { reactConfig } from "@repo/vitest-config/react"

export default mergeConfig(
  reactConfig,
  defineConfig({
    plugins: [
      viteTsConfigPaths({
        projects: ["./tsconfig.json"],
      }),
    ],
    define: {
      self: "globalThis",
      "import.meta.env.VITE_NETWORK": JSON.stringify("testnet"),
      "import.meta.env.VITE_RPC_URL": JSON.stringify("https://soroban-testnet.stellar.org"),
      "import.meta.env.VITE_HORIZON_URL": JSON.stringify("https://horizon-testnet.stellar.org"),
      "import.meta.env.VITE_CONTRACT_EXCHANGE_ROUTER": JSON.stringify(
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
      ),
      "import.meta.env.VITE_CONTRACT_SYNTHETICS_READER": JSON.stringify(
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSE2",
      ),
      "import.meta.env.VITE_CONTRACT_DATA_STORE": JSON.stringify(
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSDS",
      ),
      "import.meta.env.VITE_CONTRACT_ORDER_VAULT": JSON.stringify(
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSOV",
      ),
      "import.meta.env.VITE_CONTRACT_STAKING_ROUTER": JSON.stringify(
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSSR",
      ),
      "import.meta.env.VITE_CONTRACT_GLV_ROUTER": JSON.stringify(
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSGR",
      ),
      "import.meta.env.VITE_CONTRACT_VESTING_ROUTER": JSON.stringify(
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSVR",
      ),
      "import.meta.env.VITE_CONTRACT_REFERRAL_STORAGE": JSON.stringify(
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSRS",
      ),
    },
    test: {
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
      deps: {
        inline: [
          "react",
          "react-dom",
          "react/jsx-runtime",
          "react/jsx-dev-runtime",
          "@testing-library/react",
          "@testing-library/user-event",
          "@testing-library/jest-dom",
        ],
      },
    },
  }),
)
