import { createFileRoute } from "@tanstack/react-router"
import { ReferralsPage } from "../features/referrals/components/referrals-page"
import { TRADER_FAQS } from "../features/referrals/data/faqs"
import { SITE_URL } from "../shared/lib/site-identity"
import { faqPageJsonLd, jsonLdScript } from "../shared/lib/structured-data"

// The traders tab is the one rendered on load, so its FAQ is the one a
// crawler sees; the FAQPage markup mirrors exactly those questions (issue 954).
export const Route = createFileRoute("/referrals")({
  head: () => ({
    scripts: [
      jsonLdScript(
        faqPageJsonLd(
          `${SITE_URL}/referrals`,
          TRADER_FAQS.map((item) => ({ question: item.q, answer: item.a })),
        ),
      ),
    ],
  }),
  component: ReferralsPage,
})
