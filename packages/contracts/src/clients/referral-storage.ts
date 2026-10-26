import {
  Account,
  Address,
  Contract,
  TransactionBuilder,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk/minimal"
import type { Transaction } from "@stellar/stellar-sdk/minimal"
import type { NetworkConfig } from "../types"
import { referralCodeToScVal, scValToReferralCode } from "../soroban/referral-code"

const DUMMY_ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"

type Config = NetworkConfig & { contractId: string }

export type TierLevel = 1 | 2 | 3

export type ReferralInfo = {
  code: string | null
  tier: TierLevel
}

export type ReferralCodeStats = {
  totalTraders: number
  volume24hUsd: number
  totalVolumeUsd: number
  totalRebatesUsd: number
  tier: TierLevel
}

export type TraderRebateInfo = {
  claimableRebateUsd: number
  totalDiscountUsd: number
}

export type ReferralStorageBinding = {
  getReferralInfo: (account: string) => Promise<ReferralInfo>
  getTraderTier: (account: string) => Promise<TierLevel>
}

export class ReferralStorageClient implements ReferralStorageBinding {
  readonly contractId: string
  private server: rpc.Server

  constructor(private config: Config) {
    this.contractId = config.contractId
    this.server = new rpc.Server(config.rpcUrl, { allowHttp: false })
  }

  async getReferralInfo(account: string): Promise<ReferralInfo> {
    const [code, discountBps] = await Promise.all([
      this.getTraderReferralCode(account),
      this.getTraderDiscountBps(account),
    ])

    const tier: TierLevel = discountBps >= 500 ? 3 : discountBps >= 300 ? 2 : 1

    return { code, tier }
  }

  async getTraderTier(account: string): Promise<TierLevel> {
    const info = await this.getReferralInfo(account)
    return info.tier
  }

  getStatsForCode(code: string, period: string): Promise<ReferralCodeStats> {
    return this.getReferralCodeStats(code, period)
  }

  getTraderRebates(account: string): Promise<TraderRebateInfo> {
    return this.getTraderRebateInfo(account)
  }

  buildSetTraderReferralCodeTransaction(account: string, code: string): Promise<Transaction> {
    return this.buildReferralWriteTx("set_trader_referral_code", account, [
      referralCodeToScVal(code),
    ])
  }

  buildRegisterCodeTransaction(account: string, code: string): Promise<Transaction> {
    return this.buildReferralWriteTx("register_code", account, [referralCodeToScVal(code)])
  }

  async buildClaimRebatesTransaction(account: string, epochIds: string[]): Promise<Transaction> {
    if (epochIds.length === 0) {
      throw new Error("Select at least one rebate epoch to claim.")
    }

    const sourceAccount = await this.server.getAccount(account)
    const contract = new Contract(this.contractId)
    const accountVal = new Address(account).toScVal()
    const epochsVal = xdr.ScVal.scvVec(epochIds.map((id) => xdr.ScVal.scvSymbol(id)))

    const tx = new TransactionBuilder(sourceAccount, {
      fee: "100",
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(contract.call("claim_rebates", accountVal, epochsVal))
      .setTimeout(180)
      .build()

    const simulation = await this.server.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(simulation)) {
      throw new Error(`Transaction simulation failed: ${simulation.error}`)
    }

    return rpc.assembleTransaction(tx, simulation).build()
  }

  getTraderReferralCode(account: string): Promise<string | null> {
    const accountVal = new Address(account).toScVal()
    return this.simulateRead(
      "get_trader_referral_code",
      [accountVal],
      (value) => scValToReferralCode(value),
      null,
    )
  }

  getTraderDiscountBps(account: string): Promise<number> {
    const accountVal = new Address(account).toScVal()
    return this.simulateRead(
      "get_trader_discount_bps",
      [accountVal],
      (value) => {
        if (typeof value === "number") return value
        if (typeof value === "bigint") return Number(value)
        if (typeof value === "string") return Number(value)
        return 0
      },
      0,
    )
  }

  getReferralCodeStats(code: string, _period: string): Promise<ReferralCodeStats> {
    const codeVal = referralCodeToScVal(code)
    return this.simulateRead(
      "get_referral_stats",
      [codeVal],
      (value) => {
        if (!value || typeof value !== "object") {
          return defaultStats()
        }
        const row = value as Record<string, unknown>
        const tierRaw = row.tier ?? row.tier_level ?? 1
        const tier = Math.min(3, Math.max(1, Number(tierRaw))) as TierLevel
        return {
          totalTraders: Number(row.total_traders ?? row.totalTraders ?? 0),
          volume24hUsd: Number(row.volume_24h_usd ?? row.volume24hUsd ?? 0),
          totalVolumeUsd: Number(row.total_volume_usd ?? row.totalVolumeUsd ?? 0),
          totalRebatesUsd: Number(row.total_rebates_usd ?? row.totalRebatesUsd ?? 0),
          tier,
        }
      },
      defaultStats(),
    )
  }

  getTraderRebateInfo(account: string): Promise<TraderRebateInfo> {
    const accountVal = new Address(account).toScVal()
    return this.simulateRead(
      "get_trader_rebate_info",
      [accountVal],
      (value) => {
        if (!value || typeof value !== "object") {
          return { claimableRebateUsd: 0, totalDiscountUsd: 0 }
        }
        const row = value as Record<string, unknown>
        return {
          claimableRebateUsd: Number(row.claimable_rebate_usd ?? row.claimableRebateUsd ?? 0),
          totalDiscountUsd: Number(row.total_discount_usd ?? row.totalDiscountUsd ?? 0),
        }
      },
      { claimableRebateUsd: 0, totalDiscountUsd: 0 },
    )
  }

  getAffiliateCode(account: string): Promise<string | null> {
    const accountVal = new Address(account).toScVal()
    return this.simulateRead(
      "get_affiliate_code",
      [accountVal],
      (value) => scValToReferralCode(value),
      null,
    )
  }

  mapContractError(error: unknown): string {
    const text = error instanceof Error ? error.message : String(error)
    const upper = text.toUpperCase()

    if (upper.includes("CODE_ALREADY_TAKEN") || upper.includes("CODEALREADYTAKEN")) {
      return "Code already taken"
    }
    if (upper.includes("CODE_NOT_FOUND") || upper.includes("CODENOTFOUND")) {
      return "Referral code not found"
    }
    if (upper.includes("INVALID_INPUT")) {
      return "Invalid referral code"
    }

    return text.includes("simulation failed") ? "Transaction simulation failed" : text
  }

  private async simulateRead<T>(
    method: string,
    args: xdr.ScVal[],
    decode: (value: unknown) => T,
    fallback: T,
  ): Promise<T> {
    if (isPlaceholderContract(this.contractId)) {
      return fallback
    }

    const contract = new Contract(this.contractId)
    const dummyAccount = new Account(DUMMY_ACCOUNT, "0")

    const tx = new TransactionBuilder(dummyAccount, {
      fee: "100",
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build()

    try {
      const simulation = await this.server.simulateTransaction(tx)
      if (!rpc.Api.isSimulationSuccess(simulation)) {
        return fallback
      }

      const retval = simulation.result?.retval
      if (!retval) return fallback

      return decode(scValToNative(retval))
    } catch {
      return fallback
    }
  }

  private async buildReferralWriteTx(
    method: string,
    account: string,
    args: xdr.ScVal[],
  ): Promise<Transaction> {
    const sourceAccount = await this.server.getAccount(account)
    const contract = new Contract(this.contractId)
    const accountVal = new Address(account).toScVal()

    const tx = new TransactionBuilder(sourceAccount, {
      fee: "100",
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(contract.call(method, accountVal, ...args))
      .setTimeout(180)
      .build()

    const simulation = await this.server.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(simulation)) {
      throw new Error(`Transaction simulation failed: ${simulation.error}`)
    }

    return rpc.assembleTransaction(tx, simulation).build()
  }
}

function isPlaceholderContract(id: string): boolean {
  return id.startsWith("CXXX") || id.length < 10
}

function defaultStats(): ReferralCodeStats {
  return { totalTraders: 0, volume24hUsd: 0, totalVolumeUsd: 0, totalRebatesUsd: 0, tier: 1 }
}
