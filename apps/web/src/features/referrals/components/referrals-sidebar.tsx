import { Card, CardContent } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { getTierByLevel } from "../data/tiers"
import { AFFILIATE_FAQS, TRADER_FAQS } from "../data/faqs"
import { CodeDisplay } from "./shared/code-display"
import { FaqAccordion } from "./shared/faq-accordion"

type ExternalLinkProps = { href: string; children: React.ReactNode }

function ExternalLink({ href, children }: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between py-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      {children}
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="shrink-0 opacity-50"
      >
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </a>
  )
}

type Props = {
  tab: "traders" | "affiliates" | "distributions"
  traderCode: string | null
  affiliateCode: string | null
  traderDiscountPct: number
  affiliateTier: 1 | 2 | 3
}

export function ReferralsSidebar({
  tab,
  traderCode,
  affiliateCode,
  traderDiscountPct,
  affiliateTier,
}: Props) {
  const isAffiliate = tab === "affiliates" || tab === "distributions"
  const activeCode = isAffiliate ? affiliateCode : traderCode
  const tier = getTierByLevel(affiliateTier)
  const faqs = isAffiliate ? AFFILIATE_FAQS : TRADER_FAQS

  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 self-start lg:sticky lg:top-20 lg:w-72">
      {/* Code section */}
      {activeCode ? (
        <>
          <CodeDisplay
            code={activeCode}
            label={isAffiliate ? "Your affiliate code" : "Active referral code"}
            onEdit={isAffiliate ? () => {} : undefined}
          />

          {/* Benefit badge */}
          <div className="rounded-xl border border-border bg-card p-4">
            {isAffiliate ? (
              <>
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-10 font-semibold ring-1",
                      tier.colorClass,
                      tier.ringClass
                    )}
                  >
                    {tier.label}
                  </span>
                  <span className="text-11 text-muted-foreground">
                    Tier {tier.level}
                  </span>
                </div>
                <p className="text-xs font-semibold text-foreground">
                  {tier.affiliateCommissionPct}% commission on referral fees
                </p>
                <p className="mt-0.5 text-11 text-muted-foreground">
                  Referees receive a {tier.traderDiscountPct}% fee discount.
                </p>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold text-green-400">
                  You're receiving a {traderDiscountPct}% discount on your
                  trades!
                </p>
                <p className="mt-1 text-11 text-muted-foreground">
                  The reduced rate applies to every open and close fee.
                </p>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted/10 p-4 text-center">
          <p className="text-xs font-medium text-muted-foreground">
            {isAffiliate ? "No affiliate code yet" : "No referral code active"}
          </p>
          <p className="mt-1 text-11 text-muted-foreground/60">
            {isAffiliate
              ? "Register a code to start earning commissions"
              : "Enter a code to get a fee discount"}
          </p>
        </div>
      )}

      {/* Quick links */}
      <Card>
        <CardContent className="px-4 py-2">
          <div className="divide-y divide-border/50">
            {/* TODO: Replace # with actual docs URLs when documentation is published */}
            <ExternalLink href="#">How it works</ExternalLink>
            <ExternalLink href="#">Claiming rewards</ExternalLink>
            <ExternalLink href="#">Tiers</ExternalLink>
            <ExternalLink href="#">Transferring a referral code</ExternalLink>
          </div>
        </CardContent>
      </Card>

      {/* FAQ */}
      <FaqAccordion items={faqs} />
    </aside>
  )
}
