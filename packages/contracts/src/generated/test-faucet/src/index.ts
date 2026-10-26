import { Buffer } from "buffer"
import {
  AssembledTransaction,
  Client as ContractClient,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/minimal/contract"
import type {
  ClientOptions as ContractClientOptions,
  MethodOptions,
  u32,
  i128,
} from "@stellar/stellar-sdk/minimal/contract"

export * from "@stellar/stellar-sdk/minimal"
export * as contract from "@stellar/stellar-sdk/minimal/contract"
export * as rpc from "@stellar/stellar-sdk/minimal/rpc"

if (typeof window !== "undefined") {
  // @ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer
}

export const Errors = {
  1: { message: "AlreadyInitialized" },
  2: { message: "NotInitialized" },
  3: { message: "Unauthorized" },
  4: { message: "TokenNotEnabled" },
  5: { message: "InvalidAmount" },
  6: { message: "ClaimTooSoon" },
}

export interface Client {
  admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>
  claim: (args: { account: string; token: string }, options?: MethodOptions) => Promise<AssembledTransaction<i128>>
  set_token: (args: { caller: string; token: string; claim_amount: i128 }, options?: MethodOptions) => Promise<AssembledTransaction<null>>
  claim_many: (args: { account: string; tokens: Array<string> }, options?: MethodOptions) => Promise<AssembledTransaction<Array<i128>>>
  initialize: (args: { admin: string; cooldown_ledgers: u32 }, options?: MethodOptions) => Promise<AssembledTransaction<null>>
  claim_amount: (args: { token: string }, options?: MethodOptions) => Promise<AssembledTransaction<i128>>
  remove_token: (args: { caller: string; token: string }, options?: MethodOptions) => Promise<AssembledTransaction<null>>
  set_cooldown: (args: { caller: string; cooldown_ledgers: u32 }, options?: MethodOptions) => Promise<AssembledTransaction<null>>
  cooldown_ledgers: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>
  last_claim_ledger: (args: { account: string; token: string }, options?: MethodOptions) => Promise<AssembledTransaction<u32>>
}

export class Client extends ContractClient {
  static async deploy<T = Client>(
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        wasmHash: Buffer | string
        salt?: Buffer | Uint8Array
        format?: "hex" | "base64"
      },
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }

  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAABgAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAAAgAAAAAAAAAMVW5hdXRob3JpemVkAAAAAwAAAAAAAAAPVG9rZW5Ob3RFbmFibGVkAAAAAAQAAAAAAAAADUludmFsaWRBbW91bnQAAAAAAAAFAAAAAAAAAAxDbGFpbVRvb1Nvb24AAAAG",
        "AAAAAAAAAAAAAAAFYWRtaW4AAAAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAAAAAAAFY2xhaW0AAAAAAAACAAAAAAAAAAdhY2NvdW50AAAAABMAAAAAAAAABXRva2VuAAAAAAAAEwAAAAEAAAAL",
        "AAAAAAAAAAAAAAAJc2V0X3Rva2VuAAAAAAAAAwAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAAAAAADGNsYWltX2Ftb3VudAAAAAsAAAAA",
        "AAAAAAAAAAAAAAAKY2xhaW1fbWFueQAAAAAAAgAAAAAAAAAHYWNjb3VudAAAAAATAAAAAAAAAAZ0b2tlbnMAAAAAA+oAAAATAAAAAQAAA+oAAAAL",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAABBjb29sZG93bl9sZWRnZXJzAAAABAAAAAA=",
        "AAAAAAAAAAAAAAAMY2xhaW1fYW1vdW50AAAAAQAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAQAAAAs=",
        "AAAAAAAAAAAAAAAMcmVtb3ZlX3Rva2VuAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAA",
        "AAAAAAAAAAAAAAAMc2V0X2Nvb2xkb3duAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAABBjb29sZG93bl9sZWRnZXJzAAAABAAAAAA=",
        "AAAAAAAAAAAAAAAQY29vbGRvd25fbGVkZ2VycwAAAAAAAAABAAAABA==",
        "AAAAAAAAAAAAAAARbGFzdF9jbGFpbV9sZWRnZXIAAAAAAAACAAAAAAAAAAdhY2NvdW50AAAAABMAAAAAAAAABXRva2VuAAAAAAAAEwAAAAEAAAAE",
      ]),
      options,
    )
  }

  public readonly fromJSON = {
    admin: this.txFromJSON<string>,
    claim: this.txFromJSON<i128>,
    set_token: this.txFromJSON<null>,
    claim_many: this.txFromJSON<Array<i128>>,
    initialize: this.txFromJSON<null>,
    claim_amount: this.txFromJSON<i128>,
    remove_token: this.txFromJSON<null>,
    set_cooldown: this.txFromJSON<null>,
    cooldown_ledgers: this.txFromJSON<u32>,
    last_claim_ledger: this.txFromJSON<u32>,
  }
}
