import { describe, expect, test } from "bun:test"

describe("indexer test suite smoke check", () => {
  test("bun test environment is available", () => {
    expect(typeof Bun).toBe("object")
    expect(typeof Bun.file).toBe("function")
  })

  test("fixture contracts-repo directory is accessible", () => {
    const { existsSync } = require("fs")
    const fixturesDir = `${import.meta.dir}/fixtures/contracts-repo`
    expect(existsSync(fixturesDir)).toBe(true)
  })
})
