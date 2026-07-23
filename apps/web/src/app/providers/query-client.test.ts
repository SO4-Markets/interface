import { describe, it, expect } from "vitest";
import { queryClient } from "./query-client";

describe("queryClient configuration", () => {
  it("should have correct defaults configured", () => {
    const defaultOptions = queryClient.getDefaultOptions();
    expect(defaultOptions.queries?.retry).toBe(1);
    expect(defaultOptions.queries?.staleTime).toBe(30000);
    expect(defaultOptions.queries?.refetchOnWindowFocus).toBe(true);
  });
});
