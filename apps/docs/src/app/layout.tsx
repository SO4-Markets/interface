import type { ReactNode } from "react"

import "../styles/globals.css"

export interface RootLayoutProps {
  children: ReactNode
}

export function RootLayout({ children }: RootLayoutProps) {
  return <>{children}</>
}
