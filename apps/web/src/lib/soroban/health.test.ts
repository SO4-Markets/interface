import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { checkRpcHealth } from "./health";

const server = setupServer(
  http.post("http://localhost:8000/rpc", ({ request }) => {
    return HttpResponse.json({ result: { status: "healthy" } });
  })
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

describe("RPC Health", () => {
  it("should return healthy status when RPC responds properly", async () => {
    const result = await checkRpcHealth("http://localhost:8000/rpc");
    expect(result).toEqual({ status: "healthy", label: "Healthy" });
  });

  it("should return degraded status when RPC returns 503", async () => {
    server.use(
      http.post("http://localhost:8000/rpc", () => {
        return new HttpResponse(null, { status: 503 });
      })
    );
    const result = await checkRpcHealth("http://localhost:8000/rpc");
    expect(result).toEqual({ status: "degraded", label: "Degraded" });
  });

  it("should return degraded status when RPC returns 429", async () => {
    server.use(
      http.post("http://localhost:8000/rpc", () => {
        return new HttpResponse(null, { status: 429 });
      })
    );
    const result = await checkRpcHealth("http://localhost:8000/rpc");
    expect(result).toEqual({ status: "degraded", label: "Degraded" });
  });

  it("should return unreachable status on network error", async () => {
    server.use(
      http.post("http://localhost:8000/rpc", () => {
        return HttpResponse.error();
      })
    );
    const result = await checkRpcHealth("http://localhost:8000/rpc");
    expect(result).toEqual({ status: "unreachable", label: "Unreachable" });
  });

  it("should return unreachable status on timeout", async () => {
    vi.useFakeTimers();
    server.use(
      http.post("http://localhost:8000/rpc", async () => {
        // Will never respond in time
        return new Promise(() => {});
      })
    );

    const promise = checkRpcHealth("http://localhost:8000/rpc", 1000);
    vi.advanceTimersByTime(1500);
    const result = await promise;
    expect(result).toEqual({ status: "unreachable", label: "Timeout" });
    vi.useRealTimers();
  });
});
