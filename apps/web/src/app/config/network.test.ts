/**
 * apps/web/src/app/config/network.test.ts  (issue #244)
 *
 * Verifies network.ts derives the active config from ENV.
 *
 * Each variant loads network.ts in its own fresh Bun subprocess
 * (see test/config-harness.ts) so the module cache — including the transitive
 * env.ts — is reset between the testnet and mainnet variants.
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { Networks } from "@stellar/stellar-sdk/minimal"

import { VALID_ENV, loadNetwork } from "../../../test/config-harness"

describe("NETWORK derivation (#244)", () => {
  it("derives the testnet config from env", () => {
    const net = loadNetwork({
      ...VALID_ENV,
      VITE_NETWORK: "testnet",
      VITE_RPC_URL: "https://rpc.testnet.example",
      VITE_HORIZON_URL: "https://horizon.testnet.example",
    })

    assert.equal(net.name, "testnet")
    assert.equal(net.rpcUrl, "https://rpc.testnet.example") // from env
    assert.equal(net.horizonUrl, "https://horizon.testnet.example") // from env
    assert.equal(net.networkPassphrase, Networks.TESTNET)
    assert.equal(net.explorerBaseUrl, "https://stellar.expert/explorer/testnet")
    assert.equal(net.txUrl, "https://stellar.expert/explorer/testnet/tx/TXHASH")
    assert.equal(
      net.accountUrl,
      "https://stellar.expert/explorer/testnet/account/GACCOUNT"
    )
  })

  it("derives the mainnet config from env", () => {
    const net = loadNetwork({
      ...VALID_ENV,
      VITE_NETWORK: "mainnet",
      VITE_RPC_URL: "https://rpc.mainnet.example",
      VITE_HORIZON_URL: "https://horizon.mainnet.example",
    })

    assert.equal(net.name, "mainnet")
    assert.equal(net.rpcUrl, "https://rpc.mainnet.example") // from env
    assert.equal(net.horizonUrl, "https://horizon.mainnet.example") // from env
    assert.equal(net.networkPassphrase, Networks.PUBLIC)
    assert.equal(net.explorerBaseUrl, "https://stellar.expert/explorer/public")
    assert.equal(net.txUrl, "https://stellar.expert/explorer/public/tx/TXHASH")
    assert.equal(
      net.accountUrl,
      "https://stellar.expert/explorer/public/account/GACCOUNT"
    )
  })
})
