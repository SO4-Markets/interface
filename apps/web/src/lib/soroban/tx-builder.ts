import { sorobanRpc } from "./client"
import type { Transaction } from "@stellar/stellar-sdk/minimal"

export interface SigningWallet {
  signTransaction: (xdr: string, options?: { networkPassphrase: string }) => Promise<{
    signedTxXdr: string
  }>
}

/**
 * Prepares a Soroban transaction and signs it with the given wallet.
 *
 * Steps:
 * 1. Call sorobanRpc.prepareTransaction(tx) to add resource footprint
 * 2. Sign with wallet.signTransaction()
 * 3. Return the signed XDR string
 *
 * @param tx - The transaction to prepare and sign
 * @param wallet - Wallet instance with signTransaction method
 * @param networkPassphrase - The network passphrase
 * @returns Signed transaction XDR string
 */
export async function prepareAndSign(
  tx: Transaction,
  wallet: SigningWallet,
  networkPassphrase: string,
): Promise<string> {
  try {
    const preparedTx = await sorobanRpc.prepareTransaction(tx)
    const preparedXdr = preparedTx.toXDR()

    const { signedTxXdr } = await wallet.signTransaction(preparedXdr, {
      networkPassphrase,
    })

    return signedTxXdr
  } catch (error) {
    throw new Error(
      `Failed to prepare and sign transaction: ${error instanceof Error ? error.message : "Unknown error"}`,
    )
  }
}
