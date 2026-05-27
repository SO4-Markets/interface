import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Navbar } from "../../../ui/Navbar"
import { useTraderStats } from "../hooks/use-referrals-data"
import { useReferralCode } from "../queries/useReferralCode"
import { useReferralTier } from "../queries/useReferralTier"
import { TradersTab } from "./traders/traders-tab"
import { AffiliatesTab } from "./affiliates/affiliates-tab"
import { DistributionsTab } from "./distributions/distributions-tab"
import { ReferralsSidebar } from "./referrals-sidebar"

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
  const [tab, setTab] = useState<ReferralsTab>("traders")

  const { data: traderStats } = useTraderStats()
  const { data: affiliateCodeData } = useReferralCode()
  const { data: affiliateTier } = useReferralTier()

  const traderCode = traderStats?.referralCode ?? null
  const affiliateCode = affiliateCodeData ?? null
  const hasAffiliateCode = Boolean(affiliateCode)

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <Navbar variant="app" />
      <div className="mx-auto w-full max-w-260 px-4 pb-16 pt-8 sm:px-6 lg:px-12">
        <header className="mb-8">
          <h1 className="text-[22px] font-semibold tracking-tight">Referrals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Get fee discounts and earn up to 15% commission through the SO4 referral program
          </p>
        </header>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as ReferralsTab)}
          className="gap-6"
        >
          <TabsList className="h-9">
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

          {/* 2-column: tab content (flex-1) + sticky sidebar (w-72) */}
          <div className="flex gap-5">
            <div className="min-w-0 flex-1">
              <TabsContent value="traders">
                <TradersTab
                  onCodeApplied={() => {
                    // TODO: invalidate trader stats query after code applied
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
      </div>
    </div>
  )
}
