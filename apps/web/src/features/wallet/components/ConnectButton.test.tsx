import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useWalletStore } from "../store/wallet-store"
import { ConnectButton } from "./ConnectButton"
import { useKeyboardShortcut } from "@/shared/hooks/useKeyboardShortcut"
import { fakeWalletAddress } from "@/test/fakes/wallet"

// Mock the keyboard shortcut hook
vi.mock("@/shared/hooks/useKeyboardShortcut", () => ({
  useKeyboardShortcut: vi.fn(),
}))

// Mock the wallet provider hook
vi.mock("@/app/providers", () => ({
  useWallet: () => ({
    disconnect: vi.fn(),
  }),
}))

// Mock the useBalance hook
vi.mock("../hooks/useBalance", () => ({
  useBalance: () => null,
}))

// Mock the StellarWalletsKit import to prevent real wallet connections
vi.mock("@creit.tech/stellar-wallets-kit/sdk", () => ({}))

describe("ConnectButton - Disconnected State", () => {
  beforeEach(() => {
    // Ensure wallet store is reset to disconnected state
    useWalletStore.setState({
      address: null,
      walletId: null,
      status: "disconnected",
      pendingTransactionXdr: null,
      network: "testnet",
    })

    // Mock useKeyboardShortcut to do nothing
    ;(useKeyboardShortcut as any).mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    useWalletStore.setState({
      address: null,
      walletId: null,
      status: "disconnected",
      pendingTransactionXdr: null,
      network: "testnet",
    })
  })

  describe("Rendering", () => {
    it("should render connect button when disconnected", () => {
      render(<ConnectButton />)

      const button = screen.getByRole("button", { name: /Connect wallet/i })
      expect(button).toBeInTheDocument()
    })

    it("should display 'Connect Wallet' label when disconnected", () => {
      render(<ConnectButton />)

      const button = screen.getByRole("button", { name: /Connect wallet/i })
      expect(button).toHaveTextContent("Connect Wallet")
    })

    it("should have correct aria-label when disconnected", () => {
      render(<ConnectButton />)

      const button = screen.getByRole("button", { name: "Connect wallet" })
      expect(button).toHaveAttribute("aria-label", "Connect wallet")
    })

    it("should not be disabled when disconnected", () => {
      render(<ConnectButton />)

      const button = screen.getByRole("button", { name: /Connect wallet/i })
      expect(button).not.toBeDisabled()
    })

    it("should accept className prop", () => {
      render(<ConnectButton className="custom-class" />)

      const button = screen.getByRole("button", { name: /Connect wallet/i })
      expect(button).toHaveClass("custom-class")
    })

    it("should respect disabled prop when disconnected", () => {
      render(<ConnectButton disabled />)

      const button = screen.getByRole("button", { name: /Connect wallet/i })
      expect(button).toBeDisabled()
    })
  })

  describe("Modal Opening", () => {
    it("should open wallet modal when button is clicked", async () => {
      const user = userEvent.setup()
      render(<ConnectButton />)

      const button = screen.getByRole("button", { name: /Connect wallet/i })
      await user.click(button)

      // Dialog should be visible with wallet options
      const dialog = screen.getByRole("dialog")
      expect(dialog).toBeInTheDocument()

      const dialogTitle = screen.getByText("Connect Wallet")
      expect(dialogTitle).toBeInTheDocument()
    })

    it("should show wallet options in modal", async () => {
      const user = userEvent.setup()
      render(<ConnectButton />)

      const button = screen.getByRole("button", { name: /Connect wallet/i })
      await user.click(button)

      // Wait for wallet options to render
      // The modal should show wallet selection (actual wallets depend on availability)
      const dialog = screen.getByRole("dialog")
      expect(dialog).toBeInTheDocument()

      // Dialog description should be present
      expect(
        screen.getByText("Choose a supported Stellar wallet to continue."),
      ).toBeInTheDocument()
    })

    it("should show 'Use Mobile Wallet' section with QR code", async () => {
      const user = userEvent.setup()
      render(<ConnectButton />)

      const button = screen.getByRole("button", { name: /Connect wallet/i })
      await user.click(button)

      // Mobile wallet section should be visible
      expect(screen.getByText("Use Mobile Wallet")).toBeInTheDocument()
      expect(
        screen.getByText(/Scan to connect from a mobile wallet/),
      ).toBeInTheDocument()
    })
  })

  describe("Loading/Connecting State", () => {
    it("should show loading state when status is connecting", () => {
      useWalletStore.setState({ status: "connecting" })

      render(<ConnectButton />)

      const button = screen.getByRole("button", { name: /Connecting wallet/i })
      expect(button).toBeInTheDocument()
      expect(button).toHaveAttribute("aria-busy", "true")
    })

    it("should disable button when connecting", () => {
      useWalletStore.setState({ status: "connecting" })

      render(<ConnectButton />)

      const button = screen.getByRole("button", { name: /Connecting wallet/i })
      expect(button).toBeDisabled()
    })

    it("should show spinner when connecting", () => {
      useWalletStore.setState({ status: "connecting" })

      render(<ConnectButton />)

      // Spinner SVG should be rendered
      const svg = screen.getByRole("button").querySelector("svg")
      expect(svg).toBeInTheDocument()
      expect(svg).toHaveClass("animate-spin")
    })

    it("should not open modal when connecting", async () => {
      const user = userEvent.setup()
      useWalletStore.setState({ status: "connecting" })

      render(<ConnectButton />)

      const button = screen.getByRole("button", { name: /Connecting wallet/i })
      await user.click(button)

      // Modal should not open when in connecting state
      const dialog = screen.queryByRole("dialog")
      expect(dialog).not.toBeInTheDocument()
    })

    it("should have aria-busy attribute when connecting", () => {
      useWalletStore.setState({ status: "connecting" })

      render(<ConnectButton />)

      const button = screen.getByRole("button", { name: /Connecting wallet/i })
      expect(button).toHaveAttribute("aria-busy", "true")
    })

    it("should not have aria-busy attribute when disconnected", () => {
      render(<ConnectButton />)

      const button = screen.getByRole("button", { name: /Connect wallet/i })
      expect(button).not.toHaveAttribute("aria-busy", "true")
    })
  })

  describe("Error State", () => {
    it("should show connect button when in error state and address is null", () => {
      useWalletStore.setState({ status: "error", address: null })

      render(<ConnectButton />)

      const button = screen.getByRole("button", { name: /Connect wallet/i })
      expect(button).toBeInTheDocument()
    })

    it("should allow retry when in error state", async () => {
      const user = userEvent.setup()
      useWalletStore.setState({ status: "error", address: null })

      render(<ConnectButton />)

      const button = screen.getByRole("button", { name: /Connect wallet/i })
      expect(button).not.toBeDisabled()

      await user.click(button)

      const dialog = screen.getByRole("dialog")
      expect(dialog).toBeInTheDocument()
    })
  })

  describe("Connected State (Should Not Show Connect Button)", () => {
    it("should not show connect button when connected", () => {
      useWalletStore.setState({
        status: "connected",
        address: fakeWalletAddress,
      })

      render(<ConnectButton />)

      // Connect button should not exist
      const connectButton = screen.queryByRole("button", {
        name: /Connect wallet/i,
      })
      expect(connectButton).not.toBeInTheDocument()
    })

    it("should show account badge when connected", () => {
      useWalletStore.setState({
        status: "connected",
        address: fakeWalletAddress,
      })

      render(<ConnectButton />)

      // Account badge should be rendered instead
      expect(screen.getByText(/GAAAAAA/)).toBeInTheDocument()
    })
  })

  describe("Keyboard Shortcuts", () => {
    it("should register keyboard shortcut when disconnected", () => {
      ;(useKeyboardShortcut as any).mockImplementation((config: any) => {
        expect(config.key).toBe("k")
        expect(typeof config.onKeyPress).toBe("function")
        expect(config.enabled).toBe(true)
      })

      render(<ConnectButton />)

      expect(useKeyboardShortcut).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "k",
          enabled: true,
        }),
      )
    })

    it("should disable keyboard shortcut when connecting", () => {
      useWalletStore.setState({ status: "connecting" })

      ;(useKeyboardShortcut as any).mockImplementation((config: any) => {
        expect(config.enabled).toBe(false)
      })

      render(<ConnectButton />)

      expect(useKeyboardShortcut).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
        }),
      )
    })

    it("should disable keyboard shortcut when connected", () => {
      useWalletStore.setState({
        status: "connected",
        address: fakeWalletAddress,
      })

      ;(useKeyboardShortcut as any).mockImplementation((config: any) => {
        expect(config.enabled).toBe(false)
      })

      render(<ConnectButton />)

      expect(useKeyboardShortcut).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
        }),
      )
    })
  })

  describe("State Isolation", () => {
    it("test A: should have clean disconnected state", () => {
      const state = useWalletStore.getState()
      expect(state.address).toBeNull()
      expect(state.status).toBe("disconnected")

      render(<ConnectButton />)
      expect(screen.getByRole("button", { name: /Connect wallet/i })).toBeInTheDocument()
    })

    it("test B: should not have state from test A", () => {
      // beforeEach ensures clean state
      const state = useWalletStore.getState()
      expect(state.address).toBeNull()
      expect(state.status).toBe("disconnected")

      render(<ConnectButton />)
      expect(screen.getByRole("button", { name: /Connect wallet/i })).toBeInTheDocument()
    })

    it("should not render connected UI after render if store changes", () => {
      const { rerender } = render(<ConnectButton />)

      // Initially should show connect button
      expect(screen.getByRole("button", { name: /Connect wallet/i })).toBeInTheDocument()

      // Update store to connected state
      useWalletStore.setState({
        status: "connected",
        address: fakeWalletAddress,
      })

      // Rerender to reflect new state
      rerender(<ConnectButton />)

      // Now should show account badge instead
      expect(
        screen.queryByRole("button", { name: /Connect wallet/i }),
      ).not.toBeInTheDocument()
      expect(screen.getByText(/GAAAAAA/)).toBeInTheDocument()
    })
  })

  describe("Button Type and Default Behavior", () => {
    it("should be a button type (not submit)", () => {
      render(<ConnectButton />)

      const button = screen.getByRole("button", { name: /Connect wallet/i })
      expect(button).toHaveAttribute("type", "button")
    })

    it("should have responsive width classes", () => {
      render(<ConnectButton />)

      const button = screen.getByRole("button", { name: /Connect wallet/i })
      expect(button).toHaveClass("w-full", "sm:w-auto")
    })
  })
})
