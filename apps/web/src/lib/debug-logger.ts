/**
 * Debug logger that's silent in production builds.
 * Routes console output through this utility to prevent wallet addresses
 * and sensitive data from being logged in production.
 */

type LogLevel = "log" | "debug" | "info" | "warn" | "error"

class DebugLogger {
  private isProduction = import.meta.env.PROD

  private write(level: LogLevel, ...args: Array<unknown>) {
    if (this.isProduction) {
      return
    }
    console[level]("[DEBUG]", ...args)
  }

  log(...args: Array<unknown>) {
    this.write("log", ...args)
  }

  debug(...args: Array<unknown>) {
    this.write("debug", ...args)
  }

  info(...args: Array<unknown>) {
    this.write("info", ...args)
  }

  warn(...args: Array<unknown>) {
    this.write("warn", ...args)
  }

  error(...args: Array<unknown>) {
    this.write("error", ...args)
  }
}

export const debugLogger = new DebugLogger()
