/**
 * Asset optimization configuration for fonts, images, and critical-path resources.
 * Defines preload strategy, lazy-loading thresholds, and responsive image sizing.
 */

export const FONT_OPTIMIZATION = {
  // Critical fonts loaded in <head> with preload
  critical: [
    {
      family: "Inter",
      weights: [400, 600],
      subset: "latin",
      display: "swap",
    },
  ],
  // Optional fonts defer below-fold
  deferred: [
    {
      family: "Mono",
      weights: [400],
      subset: "latin",
      display: "fallback",
    },
  ],
}

export const IMAGE_OPTIMIZATION = {
  // Hero/above-fold images preload with optimal sizing
  critical: {
    maxWidth: 1440,
    formats: ["webp", "png"],
    sizes: {
      mobile: 400,
      tablet: 800,
      desktop: 1440,
    },
  },
  // Below-fold decorative assets defer with lazysizes
  deferred: {
    loading: "lazy",
    sizes: {
      mobile: 300,
      tablet: 600,
      desktop: 1200,
    },
  },
}

export const PRELOAD_HINTS = {
  // Preload critical market data endpoints
  dataUrls: [
    "/api/markets",
    "/api/orderbook",
  ],
  // DNS prefetch external dependencies
  dns: [
    "indexer.example.com",
    "rpc.example.com",
  ],
}

/**
 * Generate srcset for responsive image loading
 */
export function generateImageSrcSet(
  basePath: string,
  formats: Array<string> = ["webp"]
): string {
  return formats
    .map(
      (fmt) =>
        `${basePath}?fmt=${fmt}&w=400 400w, ${basePath}?fmt=${fmt}&w=800 800w, ${basePath}?fmt=${fmt}&w=1440 1440w`
    )
    .join(", ")
}
