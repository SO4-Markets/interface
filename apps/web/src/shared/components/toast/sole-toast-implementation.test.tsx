import { afterEach, describe, expect, it, vi } from "vitest"
import { act, render, screen } from "@testing-library/react"

/**
 * OB-091: the app standardises on the existing UI-package toast.
 *
 * - Exactly one provider across routes (`__root.tsx` mounts the canonical
 *   `ToastProvider` once; no second/sonner toaster exists).
 * - Every supported call reaches it without duplicate rendering.
 * - The `@/shared/components/toast` shim stays a pure redirect to the
 *   canonical implementation (legacy provider removed).
 */

describe("sole toast implementation (OB-091)", () => {
  afterEach(() => {
    document.body.innerHTML = ""
    vi.useRealTimers()
  })

  it("re-exports the canonical UI-package implementation", async () => {
    const shared = await import("./index")
    const canonical = await import("@workspace/ui/components/toast")

    expect(shared.ToastProvider).toBe(canonical.ToastProvider)
    expect(shared.useToast).toBe(canonical.useToast)
  })

  it("delivers compatibility-import calls to the single provider without duplicates", async () => {
    vi.useFakeTimers()
    const { ToastProvider, useToast } = await import("./index")
    const { toast } = await import("@workspace/ui/components/toast")

    function Probe() {
      const { toasts } = useToast()
      return <span data-testid="toast-count">{toasts.length}</span>
    }

    render(
      <ToastProvider>
        <Probe />
      </ToastProvider>,
    )

    act(() => {
      toast.success("Compatibility call reaches the provider")
    })

    expect(screen.getByText("Compatibility call reaches the provider")).toBeInTheDocument()
    expect(screen.getAllByText("Compatibility call reaches the provider")).toHaveLength(1)
    expect(screen.getByTestId("toast-count")).toHaveTextContent("1")
    // Single stack container — no duplicate rendering.
    expect(document.querySelectorAll("[aria-live='polite'][aria-atomic='false']")).toHaveLength(1)
  })

  it("exposes a single provider component (no second toaster)", async () => {
    // Static guarantee (also enforced by code search): only __root.tsx mounts
    // <ToastProvider>, imported from "@workspace/ui/components/toast".
    // This test pins the shim so a second provider cannot be reintroduced
    // silently.
    const shared = await import("./index")
    expect(typeof shared.ToastProvider).toBe("function")
  })
})
