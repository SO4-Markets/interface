import { useSyncExternalStore } from "react"

const query = "(forced-colors: active), (prefers-contrast: more)"

function subscribe(notify: () => void) {
  if (typeof window.matchMedia !== "function") return () => {}
  const media = window.matchMedia(query)
  media.addEventListener("change", notify)
  return () => media.removeEventListener("change", notify)
}

export function useHighContrast() {
  return useSyncExternalStore(subscribe, () => typeof window.matchMedia === "function" && window.matchMedia(query).matches, () => false)
}
