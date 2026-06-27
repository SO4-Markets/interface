export const fakeWalletAddress = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
export const fakeNetwork = "testnet" as const
export const fakeSignedXdr = "AAAAAgAAAAAFakeSignedTransactionEnvelope"

export const fakeSigner = {
  signTransaction() {
    return { signedTxXdr: fakeSignedXdr }
  },
}
