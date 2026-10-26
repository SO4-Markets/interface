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
  4: { message: "InsufficientBalance" },
  5: { message: "InsufficientAllowance" },
  6: { message: "NegativeAmount" },
  7: { message: "AllowanceExpired" },
  8: { message: "Paused" },
}

export interface Client {
  burn: (args: { from: string; amount: i128 }, options?: MethodOptions) => Promise<AssembledTransaction<null>>
  mint: (args: { caller: string; account: string; amount: i128 }, options?: MethodOptions) => Promise<AssembledTransaction<null>>
  name: (options?: MethodOptions) => Promise<AssembledTransaction<string>>
  owner: (options?: MethodOptions) => Promise<AssembledTransaction<string>>
  pause: (args: { caller: string }, options?: MethodOptions) => Promise<AssembledTransaction<null>>
  paused: (options?: MethodOptions) => Promise<AssembledTransaction<boolean>>
  symbol: (options?: MethodOptions) => Promise<AssembledTransaction<string>>
  approve: (args: { from: string; spender: string; amount: i128; expiration_ledger: u32 }, options?: MethodOptions) => Promise<AssembledTransaction<null>>
  balance: (args: { id: string }, options?: MethodOptions) => Promise<AssembledTransaction<i128>>
  unpause: (args: { caller: string }, options?: MethodOptions) => Promise<AssembledTransaction<null>>
  decimals: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>
  transfer: (args: { from: string; to: string; amount: i128 }, options?: MethodOptions) => Promise<AssembledTransaction<null>>
  allowance: (args: { from: string; spender: string }, options?: MethodOptions) => Promise<AssembledTransaction<i128>>
  burn_from: (args: { spender: string; from: string; amount: i128 }, options?: MethodOptions) => Promise<AssembledTransaction<null>>
  initialize: (args: { owner: string; decimal: u32; name: string; symbol: string }, options?: MethodOptions) => Promise<AssembledTransaction<null>>
  total_supply: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>
  transfer_from: (args: { spender: string; from: string; to: string; amount: i128 }, options?: MethodOptions) => Promise<AssembledTransaction<null>>
  transfer_owner: (args: { caller: string; new_owner: string }, options?: MethodOptions) => Promise<AssembledTransaction<null>>
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
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAACAAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAAAgAAAAAAAAAMVW5hdXRob3JpemVkAAAAAwAAAAAAAAATSW5zdWZmaWNpZW50QmFsYW5jZQAAAAAEAAAAAAAAABVJbnN1ZmZpY2llbnRBbGxvd2FuY2UAAAAAAAAFAAAAAAAAAA5OZWdhdGl2ZUFtb3VudAAAAAAABgAAAAAAAAAQQWxsb3dhbmNlRXhwaXJlZAAAAAcAAAAAAAAABlBhdXNlZAAAAAAACA==",
        "AAAAAAAAAAAAAAAEYnVybgAAAAIAAAAAAAAABGZyb20AAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAA",
        "AAAAAAAAAAAAAAAEbWludAAAAAMAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAHYWNjb3VudAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAA",
        "AAAAAAAAAAAAAAAEbmFtZQAAAAAAAAABAAAAEA==",
        "AAAAAAAAAAAAAAAFb3duZXIAAAAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAAAAAAAFcGF1c2UAAAAAAAABAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAA",
        "AAAAAAAAAAAAAAAGcGF1c2VkAAAAAAAAAAAAAQAAAAE=",
        "AAAAAAAAAAAAAAAGc3ltYm9sAAAAAAAAAAAAAQAAABA=",
        "AAAAAAAAAAAAAAAHYXBwcm92ZQAAAAAEAAAAAAAAAARmcm9tAAAAEwAAAAAAAAAHc3BlbmRlcgAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAEWV4cGlyYXRpb25fbGVkZ2VyAAAAAAAABAAAAAA=",
        "AAAAAAAAAAAAAAAHYmFsYW5jZQAAAAABAAAAAAAAAAJpZAAAAAAAEwAAAAEAAAAL",
        "AAAAAAAAAAAAAAAHdW5wYXVzZQAAAAABAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAA",
        "AAAAAAAAAAAAAAAIZGVjaW1hbHMAAAAAAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAAIdHJhbnNmZXIAAAADAAAAAAAAAARmcm9tAAAAEwAAAAAAAAACdG8AAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAA=",
        "AAAAAAAAAAAAAAAJYWxsb3dhbmNlAAAAAAAAAgAAAAAAAAAEZnJvbQAAABMAAAAAAAAAB3NwZW5kZXIAAAAAEwAAAAEAAAAL",
        "AAAAAAAAAAAAAAAJYnVybl9mcm9tAAAAAAAAAwAAAAAAAAAHc3BlbmRlcgAAAAATAAAAAAAAAARmcm9tAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAA==",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAABAAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAdkZWNpbWFsAAAAAAQAAAAAAAAABG5hbWUAAAAQAAAAAAAAAAZzeW1ib2wAAAAAABAAAAAA",
        "AAAAAAAAAAAAAAAMdG90YWxfc3VwcGx5AAAAAAAAAAEAAAAL",
        "AAAAAAAAAAAAAAANdHJhbnNmZXJfZnJvbQAAAAAAAAQAAAAAAAAAB3NwZW5kZXIAAAAAEwAAAAAAAAAEZnJvbQAAABMAAAAAAAAAAnRvAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAA",
        "AAAAAAAAAAAAAAAOdHJhbnNmZXJfb3duZXIAAAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAJbmV3X293bmVyAAAAAAAAEwAAAAA=",
      ]),
      options,
    )
  }

  public readonly fromJSON = {
    burn: this.txFromJSON<null>,
    mint: this.txFromJSON<null>,
    name: this.txFromJSON<string>,
    owner: this.txFromJSON<string>,
    pause: this.txFromJSON<null>,
    paused: this.txFromJSON<boolean>,
    symbol: this.txFromJSON<string>,
    approve: this.txFromJSON<null>,
    balance: this.txFromJSON<i128>,
    unpause: this.txFromJSON<null>,
    decimals: this.txFromJSON<u32>,
    transfer: this.txFromJSON<null>,
    allowance: this.txFromJSON<i128>,
    burn_from: this.txFromJSON<null>,
    initialize: this.txFromJSON<null>,
    total_supply: this.txFromJSON<i128>,
    transfer_from: this.txFromJSON<null>,
    transfer_owner: this.txFromJSON<null>,
  }
}
