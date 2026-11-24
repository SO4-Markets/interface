type MarketLists = { recent: Array<string>; watchlist: Array<string> }

function read(key: string) {
  try { return JSON.parse(localStorage.getItem(key) ?? "null") } catch { return null }
}

function ids(values: unknown): Array<string> {
  return Array.isArray(values) ? [...new Set(values.filter((id): id is string => typeof id === "string" && id.length > 0))] : []
}

export function readMarketLists(network: string): MarketLists {
  const saved = read("so4-market-lists-v2:" + network)
  if (saved?.version === 2) return { recent: ids(saved.recent).slice(0, 5), watchlist: ids(saved.watchlist) }
  const favorites = read("so4-market-favorites-v1:" + network)
  return { recent: ids(read("so4-recent-markets-v1")).slice(0, 5), watchlist: ids(favorites?.markets ?? favorites) }
}

export function saveMarketLists(network: string, lists: MarketLists) {
  try {
    localStorage.setItem("so4-market-lists-v2:" + network, JSON.stringify({ version: 2, ...lists }))
  } catch { /* Browsing markets also works with session-only preferences. */ }
}
