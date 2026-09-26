import { defineNitroConfig } from "nitro/config"

export default defineNitroConfig({
  errorHandler: "./error.ts",
  publicAssets: [
    {
      dir: "public",
    },
    {
      dir: ".nitro-static",
    },
  ],
  routeRules: {
    "/**": {
      headers: {
        "Cache-Control": "s-maxage=300, stale-while-revalidate=86400",
        "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';"
      }
    },
    "/assets/**": {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    }
  },
  handlers: [
    {
      route: "/old-path",
      handler: "./redirect.ts"
    },
    // DX-061: "was this helpful" feedback. `serverDir` is unset, so file-based
    // route scanning under routes/ never runs (see scanServerRoutes in
    // nitro's own source) — /old-path above only works because it is
    // registered explicitly here, and this endpoint needs the same explicit
    // registration for the same reason.
    {
      route: "/api/feedback",
      method: "post",
      handler: "./routes/api/feedback.post.ts"
    }
  ]
})
