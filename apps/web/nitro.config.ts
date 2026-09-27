import { defineNitroConfig } from "nitro/config"
import { getNitroRouteRules } from "./src/shared/lib/cache-headers"

export default defineNitroConfig({
  routeRules: getNitroRouteRules(),
})
