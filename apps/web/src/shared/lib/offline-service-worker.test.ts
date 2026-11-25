import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import { beforeEach, describe, expect, it, vi } from "vitest"

const source = readFileSync(new URL("../../../public/sw.js", import.meta.url), "utf8")

type WorkerEvent = {
  request?: { method: string; mode: string; url: string }
  waitUntil?: (promise: Promise<unknown>) => void
  respondWith?: (promise: Promise<Response>) => void
}

function createWorker(fetchImpl: typeof fetch) {
  const listeners = new Map<string, (event: WorkerEvent) => void>()
  const cache = { add: vi.fn(async () => undefined) }
  const fallback = new Response("offline fallback")
  const cacheApi = {
    open: vi.fn(async () => cache),
    keys: vi.fn(async () => ["so4-offline-old", "other-cache"]),
    delete: vi.fn(async () => true),
    match: vi.fn(async () => fallback),
  }
  const worker = {
    location: new URL("https://so4.example/sw.js"),
    clients: { claim: vi.fn(async () => undefined) },
    skipWaiting: vi.fn(async () => undefined),
    addEventListener: (name: string, listener: (event: WorkerEvent) => void) => listeners.set(name, listener),
  }

  runInNewContext(source, {
    self: worker,
    caches: cacheApi,
    fetch: fetchImpl,
    URL,
    Response,
  })

  return { listeners, cache, cacheApi, worker }
}

describe("offline service worker", () => {
  beforeEach(() => vi.restoreAllMocks())

  it("precaches only the static offline fallback and claims the app", async () => {
    const { listeners, cache, worker } = createWorker(vi.fn() as unknown as typeof fetch)
    let install: Promise<unknown> | undefined
    listeners.get("install")?.({ waitUntil: (promise) => { install = promise } })

    await install
    expect(cache.add).toHaveBeenCalledWith("/offline.html")
    expect(worker.skipWaiting).toHaveBeenCalledOnce()
  })

  it("uses the static fallback for failed page navigations without caching page data", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("offline")) as unknown as typeof fetch
    const { listeners, cacheApi } = createWorker(fetchImpl)
    let response: Promise<Response> | undefined
    listeners.get("fetch")?.({
      request: { method: "GET", mode: "navigate", url: "https://so4.example/trade" },
      respondWith: (promise) => { response = promise },
    })

    await expect(response).resolves.toBeInstanceOf(Response)
    expect(cacheApi.match).toHaveBeenCalledWith("/offline.html")
    expect(cacheApi.open).not.toHaveBeenCalled()
  })

  it("does not intercept API requests or transaction methods", () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch
    const { listeners } = createWorker(fetchImpl)
    const respondWith = vi.fn()

    listeners.get("fetch")?.({
      request: { method: "POST", mode: "cors", url: "https://so4.example/api/transactions" },
      respondWith,
    })

    expect(respondWith).not.toHaveBeenCalled()
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})