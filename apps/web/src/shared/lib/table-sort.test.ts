import { describe, expect, it } from "vitest"
import { formatSortParam, optionalSearchString, parseSortParam } from "./table-sort"

describe("table sort URL params (issue 966)", () => {
  const columns = ["pool", "tvl", "apr"]

  it("round-trips a sort state", () => {
    const sort = { columnId: "tvl", direction: "desc" as const }
    expect(parseSortParam(formatSortParam(sort), columns)).toEqual(sort)
    expect(formatSortParam(null)).toBeUndefined()
  })

  it("rejects unknown columns, directions, and non-strings", () => {
    expect(parseSortParam("mark.asc", columns)).toBeNull()
    expect(parseSortParam("tvl.up", columns)).toBeNull()
    expect(parseSortParam("tvl", columns)).toBeNull()
    expect(parseSortParam(42, columns)).toBeNull()
    expect(parseSortParam(undefined, columns)).toBeNull()
  })

  it("keeps only non-empty string search values", () => {
    expect(optionalSearchString("tvl.asc")).toBe("tvl.asc")
    expect(optionalSearchString("")).toBeUndefined()
    expect(optionalSearchString(["tvl.asc"])).toBeUndefined()
  })
})
