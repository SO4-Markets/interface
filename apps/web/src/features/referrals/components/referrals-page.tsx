import { useState } from "react"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { AppShell } from "@workspace/ui/components/app-shell"
import { PageHeader } from "@workspace/ui/components/page-header"
import { useQueryClient } from "@tanstack/react-query"
import { Navbar } from "../../../ui/Navbar"
import { useTraderStats } from "../hooks/use-referrals-data"
import { useReferralCode } from "../queries/useReferralCode"
import { useReferralTier } from "../queries/useReferralTier"
import { TradersTab } from "./traders/traders-tab"
import { AffiliatesTab } from "./affiliates/affiliates-tab"
import { DistributionsTab } from "./distributions/distributions-tab"
import { ReferralsSidebar } from "./referrals-sidebar"
import { queryKeys } from "@/shared/lib/query-keys"

type ReferralsTab = "traders" | "affiliates" | "distributions"

function LockIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="opacity-50"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

export function ReferralsPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<ReferralsTab>("traders")

  const { data: traderStats } = useTraderStats()
  const { data: affiliateCodeData } = useReferralCode()
  const { data: affiliateTier } = useReferralTier()

  const traderCode = traderStats?.referralCode ?? null
  const affiliateCode = affiliateCodeData ?? null
  const hasAffiliateCode = Boolean(affiliateCode)

  return (
    <AppShell navbar={<Navbar variant="app" />} maxWidth="260">
      <PageHeader
        title="Referrals"
        description="Get fee discounts and earn up to 15% commission through the SO4 referral program"
        tabs={
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as ReferralsTab)}
            className="gap-6"
          >
            <TabsList className="h-9 w-full overflow-x-auto sm:w-fit">
              <TabsTrigger value="traders">Traders</TabsTrigger>
              <TabsTrigger value="affiliates">Affiliates</TabsTrigger>
              <TabsTrigger
                value="distributions"
                className="gap-1.5"
                disabled={!hasAffiliateCode}
              >
                {!hasAffiliateCode && <LockIcon />}
                Distributions
              </TabsTrigger>
            </TabsList>

            {/* Stacks on mobile; 2-column (content + sticky sidebar) from lg up */}
            <div className="flex flex-col gap-5 lg:flex-row">
              <div className="min-w-0 flex-1">
                <TabsContent value="traders">
                  <TradersTab
                    onCodeApplied={() => {
                      void queryClient.invalidateQueries({
                        queryKey: queryKeys.referrals.traderStatsAll(),
                      })
                      void queryClient.invalidateQueries({
                        queryKey: queryKeys.referrals.tier(null),
                      })
                    }}
                  />
                </TabsContent>
                <TabsContent value="affiliates">
                  <AffiliatesTab />
                </TabsContent>
                <TabsContent value="distributions">
                  <DistributionsTab />
                </TabsContent>
              </div>

              <ReferralsSidebar
                tab={tab}
                traderCode={traderCode}
                affiliateCode={affiliateCode}
                traderDiscountPct={traderStats?.discountPct ?? 5}
                affiliateTier={affiliateTier ?? 1}
              />
            </div>
          </Tabs>
        }
      />
    </AppShell>
  )
}
