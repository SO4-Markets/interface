import { defineNitroErrorHandler } from "nitropack/runtime"
import { setResponseStatus } from "h3"

export default defineNitroErrorHandler((event, { error }) => {
  if (error && (error.statusCode === 404 || (error as any).status === 404)) {
    setResponseStatus(event, 404)
  }
})
