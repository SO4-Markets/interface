export const fakeWalletAddress = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
export const fakeSignedXdr = "AAAAAgAAAAAFakeSignedTransactionEnvelope"

export const fakeSigner = {
  async signTransaction() {
    return { signedTxXdr: fakeSignedXdr }
  },
}
