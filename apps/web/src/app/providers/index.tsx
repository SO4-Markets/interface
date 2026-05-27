import type { ReactNode } from "react"

import { ThemeProvider } from "@/ui/theme-provider"

import { QueryProvider } from "./QueryProvider"

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <WalletProvider>
        <ThemeProvider>{children}</ThemeProvider>
      </WalletProvider>
    </QueryProvider>
  )
}

function WalletProvider({ children }: { children: ReactNode }) {
  return children
}

export { QueryProvider }
