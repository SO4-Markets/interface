import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit/sdk"
import { NETWORK } from "@/app/config/network"
import type { SigningWallet } from "@/lib/soroban/tx-builder"

/**
 * Wallet adapter used by prepareAndSign() for Soroban write transactions.
 * StellarWalletsKit is initialised in AppProviders on app mount.
 */
export const walletKit: SigningWallet = {
  signTransaction: async (xdr, options) => {
    const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
      networkPassphrase: options?.networkPassphrase ?? NETWORK.networkPassphrase,
    })
    return { signedTxXdr }
  },
}
