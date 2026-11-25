import type { SigningWallet } from "@/lib/soroban/tx-builder"
import { NETWORK } from "@/app/config/network"
import { assertOnlineForTransaction } from "@/shared/lib/network-safety"

/**
 * Wallet adapter used by prepareAndSign() for Soroban write transactions.
 * StellarWalletsKit is initialised in AppProviders on app mount.
 */
export const walletKit: SigningWallet = {
  signTransaction: async (xdr, options) => {
    assertOnlineForTransaction()
    const { StellarWalletsKit } = await import("@creit.tech/stellar-wallets-kit/sdk")
    const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
      networkPassphrase: options?.networkPassphrase ?? NETWORK.networkPassphrase,
    })
    return { signedTxXdr }
  },
}
