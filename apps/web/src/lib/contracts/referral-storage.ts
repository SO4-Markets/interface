import { CONTRACTS } from "@/app/config/contracts"

export type TierLevel = 1 | 2 | 3

export type ReferralInfo = {
  /** Affiliate code registered to the account, or null when none is set. */
  code: string | null
  /** Trader tier (1=Bronze, 2=Silver, 3=Gold). */
  tier: TierLevel
}

export type ReferralStorageBinding = {
  getReferralInfo: (account: string) => Promise<ReferralInfo>
  getTraderTier: (account: string) => Promise<TierLevel>
}

/**
 * Client for the ReferralStorage Soroban contract.
 *
 * Read methods currently return the empty default — the shared Soroban read
 * (simulate + XDR decode) layer is still a stub across the app (see
 * StakingRouterClient). The method signatures and return types are the stable
 * surface the referral hooks consume.
 */
export class ReferralStorageClient implements ReferralStorageBinding {
  readonly contractId: string

  constructor(contractId = CONTRACTS.referralStorage) {
    this.contractId = contractId
  }

  async getReferralInfo(_account: string): Promise<ReferralInfo> {
    // TODO: simulate ReferralStorage.get_referral_info(account) on
    // `this.contractId` and decode { code: bytes32 -> string | null, tier: u32 }.
    return { code: null, tier: 1 }
  }

  async getTraderTier(account: string): Promise<TierLevel> {
    const info = await this.getReferralInfo(account)
    return info.tier
  }
}
