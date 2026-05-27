import { TransactionBuilder } from "@stellar/stellar-sdk"
import { sorobanRpc } from "./client"
import type { Transaction} from "@stellar/stellar-sdk";

export interface SigningWallet {
  signTransaction: (xdr: string, options?: { networkPassphrase: string }) => Promise<{
    signedTxXdr: string
  }>
}

/**
 * Prepares a Soroban transaction and signs it with the given wallet
 *
 * Steps:
 * 1. Call sorobanRpc.prepareTransaction(tx) to add resource footprint
 * 2. Sign with wallet.signTransaction()
 * 3. Return the signed XDR string
 *
 * @param tx - The transaction to prepare and sign
 * @param wallet - Wallet instance with signTransaction method
 * @param networkPassphrase - The network passphrase (e.g., "Test SDF Future Network ; May 2026")
 * @returns Signed transaction XDR string
 * @throws Error with readable message if preparation fails (e.g., insufficient resource fee)
 */
export async function prepareAndSign(
  tx: Transaction | string,
  wallet: SigningWallet,
  networkPassphrase: string,
): Promise<string> {
  try {
    // Handle both Transaction objects and XDR strings
    const xdrString = typeof tx === "string" ? tx : tx.toXDR()

    // Prepare the transaction: adds resource footprint, calculates fees
    let preparedTx: Transaction
    try {
      preparedTx = await sorobanRpc.prepareTransaction(xdrString)
    } catch (error) {
      // Provide readable error messages for common failures
      if (error instanceof Error) {
        if (error.message.includes("insufficient") || error.message.includes("fee")) {
          throw new Error(
            `Transaction preparation failed: Insufficient resource fee. ${error.message}`,
          )
        }
        if (error.message.includes("resource")) {
          throw new Error(
            `Transaction preparation failed: Resource limit exceeded. ${error.message}`,
          )
        }
        throw new Error(`Transaction preparation failed: ${error.message}`)
      }
      throw error
    }

    // Convert prepared transaction to XDR for signing
    const preparedXdr = preparedTx.toXDR()

    // Sign with wallet
    const { signedTxXdr } = await wallet.signTransaction(preparedXdr, {
      networkPassphrase,
    })

    return signedTxXdr
  } catch (error) {
    if (error instanceof Error && error.message.includes("preparation failed")) {
      throw error
    }
    throw new Error(
      `Failed to prepare and sign transaction: ${error instanceof Error ? error.message : "Unknown error"}`,
    )
  }
}
