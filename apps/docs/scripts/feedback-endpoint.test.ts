import { afterAll, beforeAll, expect, test } from "bun:test"
import { spawn, type Subprocess } from "bun"
import { join } from "node:path"

// Exercises the real built server (routes/api/feedback.post.ts), the same
// way scripts/nitro.test.ts does — a unit test cannot see Nitro's routing or
// its `useStorage` global, so this is the only way to prove the endpoint
// works end to end.
let server: Subprocess
const PORT = 3006

beforeAll(async () => {
  const appRoot = import.meta.dirname.replace(/\/scripts$/, "")
  server = spawn(["node", join(appRoot, ".output/server/index.mjs")], {
    env: { ...process.env, PORT: String(PORT) },
    stdout: "inherit",
    stderr: "inherit",
  })

  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/resources/faq`)
      if (res.ok) break
    } catch {
      await Bun.sleep(100)
    }
  }
})

afterAll(() => {
  server?.kill()
})

test("accepts a valid submission and sets no cookie", async () => {
  const res = await fetch(`http://localhost:${PORT}/api/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "/concepts/risk", verdict: "yes" }),
  })

  expect(res.status).toBe(204)
  expect(res.headers.get("set-cookie")).toBeNull()
})

test("accepts a comment and does not echo it back unredacted", async () => {
  const res = await fetch(`http://localhost:${PORT}/api/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "/concepts/risk",
      verdict: "no",
      comment: "reach me at trader@example.com",
    }),
  })

  expect(res.status).toBe(204)
})

test("rejects a malformed submission with 400 rather than throwing", async () => {
  const res = await fetch(`http://localhost:${PORT}/api/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "/concepts/risk", verdict: "definitely" }),
  })

  expect(res.status).toBe(400)
})

test("rejects a missing path", async () => {
  const res = await fetch(`http://localhost:${PORT}/api/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ verdict: "yes" }),
  })

  expect(res.status).toBe(400)
})
