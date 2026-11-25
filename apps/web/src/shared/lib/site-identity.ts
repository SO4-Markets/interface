// Canonical destinations for web metadata, product links, and community links.
// Product name/domain pending confirmation in SO4-Markets/interface issue 846.
export const SITE_NAME = "SO4 Market"
export const SITE_URL = "https://so4.market"
export const REPO_URL = "https://github.com/SO4-Markets/interface"
export const DOCS_URL = "https://docs.so4.market"
export const SOCIAL_URLS = {
  x: "https://twitter.com/so4market",
  discord: "https://discord.gg/so4market",
  telegram: "https://t.me/so4market",
  github: REPO_URL,
} as const

// Shared by page metadata, structured data (issue 954) and share cards (issue 955), so
// every surface that names the product reads the same values.
export const ORGANIZATION_NAME = "SO4 Markets"
export const SITE_TAGLINE = "On-chain perpetuals"
export const SITE_DESCRIPTION =
  "A unified-liquidity perp DEX. Deep books, sub-second matching, and self-custodied risk — built for traders who care where their fills come from."
export const SITE_LOGO_URL = `${SITE_URL}/logo512.png`
export const TWITTER_HANDLE = "@so4market"
