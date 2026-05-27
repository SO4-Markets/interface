import { CONTRACTS } from "@/app/config/contracts"

export type VestingSchedule = {
  /** Total esSO4 locked into vesting. */
  deposited: bigint
  /** Amount that has linearly vested so far. */
  vested: bigint
  /** Vested amount available to claim now. */
  claimable: bigint
  /** Unix seconds when linear vesting completes (0 when no active schedule). */
  vestingEndTimestamp: number
}

export type VestingRouterBinding = {
  getVestingSchedule: (account: string) => Promise<VestingSchedule>
}

/**
 * Client for the VestingRouter Soroban contract (esSO4 12-month linear vesting).
 *
 * The read returns the empty default until the shared Soroban read layer is
 * implemented (see StakingRouterClient); the signature/return type are the
 * stable surface that useVestingSchedule consumes.
 */
export class VestingRouterClient implements VestingRouterBinding {
  readonly contractId: string

  constructor(contractId = CONTRACTS.vestingRouter) {
    this.contractId = contractId
  }

  async getVestingSchedule(_account: string): Promise<VestingSchedule> {
    // TODO: simulate VestingRouter.get_vesting_schedule(account) on
    // `this.contractId` and decode the i128 deposited/vested/claimable + u64 end.
    return { deposited: 0n, vested: 0n, claimable: 0n, vestingEndTimestamp: 0 }
  }
}
