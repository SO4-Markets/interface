import { createFileRoute } from "@tanstack/react-router"

import "../styles/landing.css"

import { HeaderMenu } from "../ui/landing/header-menu"
import { HeroSection } from "../ui/landing/hero-section"
import { OrderbookPreview } from "../ui/landing/orderbook-preview"
import { LaunchSection } from "../ui/landing/launch-section"
import { LiquiditySection } from "../ui/landing/liquidity-section"
import { SponsorsSection } from "../ui/landing/sponsors-section"
import { ProgramCards } from "../ui/landing/program-cards"
import { FaqSection } from "../ui/landing/faq-section"
import { RoadmapSection } from "../ui/landing/roadmap-section"
import { SocialSection } from "../ui/landing/social-section"

export const Route = createFileRoute("/")({ component: LandingPage })

function LandingPage() {
  return (
    // GMX's landing is dark-only — force the `.dark` token scope on this
    // subtree regardless of the user's theme setting (docs/gf_3/001_theme_update.md §7),
    // without touching <html> so /trade, /pools, etc. keep honoring it.
    <div className="dark min-h-svh bg-background font-landing-sans text-foreground antialiased">
      <HeaderMenu />
      {/* Lighthouse flagged "Document does not have a main landmark" — every
          section below is the page's actual content, HeaderMenu is the only
          non-main landmark. */}
      <main id="main-content" tabIndex={-1} className="scroll-mt-16">
        <HeroSection />
        <OrderbookPreview />
        <LaunchSection />
        <LiquiditySection />
        <SponsorsSection />
        <ProgramCards />
        <FaqSection />
        <RoadmapSection />
        <SocialSection />
      </main>
    </div>
  )
}
