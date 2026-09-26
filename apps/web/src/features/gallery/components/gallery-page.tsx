import { useState } from "react"
import { AppShell } from "@workspace/ui/components/app-shell"
import { Avatar, AvatarGroup } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Callout } from "@workspace/ui/components/callout"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { InterruptiblePresence } from "@workspace/ui/components/interruptible-presence"
import { KeyboardShortcut } from "@workspace/ui/components/keyboard-shortcut"
import { LiveRegion } from "@workspace/ui/components/live-region"
import { PageHeader } from "@workspace/ui/components/page-header"
import { ProgressIndicator } from "@workspace/ui/components/progress-indicator"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Divider, Separator } from "@workspace/ui/components/separator"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Slider } from "@workspace/ui/components/slider"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { VisuallyHidden } from "@workspace/ui/components/visually-hidden"
import type { ProgressIndicatorProps } from "@workspace/ui/components/progress-indicator"
import { useDirection } from "@/ui/direction-provider"
import { ChangelogCategoryBadge } from "@/features/changelog/components/ChangelogCategoryBadge"
import { CHANGELOG_ENTRY_TYPES } from "@/features/changelog/types"

const BUTTON_VARIANTS = [
  "default",
  "outline",
  "secondary",
  "ghost",
  "destructive",
  "link",
] as const
const BUTTON_SIZES = ["xs", "sm", "default", "lg"] as const
const BADGE_VARIANTS = [
  "default",
  "secondary",
  "destructive",
  "outline",
  "ghost",
  "link",
] as const
const AVATAR_SIZES = ["xs", "sm", "md", "lg", "xl", "2xl"] as const
const PROGRESS_SIZES = ["sm", "md", "lg"] as const
const PROGRESS_TONES = [
  "neutral",
  "accent",
  "success",
  "danger",
] as const satisfies ReadonlyArray<NonNullable<ProgressIndicatorProps["tone"]>>
const SEPARATOR_TONES = ["subtle", "default", "strong"] as const

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="rounded-lg border border-border bg-card p-6">
        {children}
      </div>
    </section>
  )
}

/**
 * DS-047 / DS-049: a living catalogue of packages/ui primitives, rendered
 * with every variant/size so it doubles as:
 * - a manual QA surface for reviewing a component change across all its
 *   states at once, instead of hunting through feature pages for one that
 *   happens to use the variant you touched
 * - the fixed target for the light/dark, desktop/mobile visual regression
 *   suite (see e2e/design-system-visual.spec.ts)
 *
 * Not a Storybook replacement — no controls/knobs, no isolated iframe.
 * Just render every shipped variant so a regression is visible on sight.
 */
export function GalleryPage() {
  const { direction, setDirection } = useDirection()
  const [sliderValue, setSliderValue] = useState<Array<number>>([40])
  const [announceCount, setAnnounceCount] = useState(0)
  const [presenceOpen, setPresenceOpen] = useState(true)

  return (
    <main className="mx-auto max-w-4xl space-y-10 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Component Gallery
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every packages/ui primitive, all variants. See{" "}
            <a
              href="https://github.com/Levee-HQ/interface/blob/main/DESIGN.md"
              className="text-primary underline underline-offset-2"
            >
              DESIGN.md
            </a>{" "}
            and{" "}
            <a
              href="https://github.com/Levee-HQ/interface/blob/main/packages/ui/CONTRIBUTING.md"
              className="text-primary underline underline-offset-2"
            >
              packages/ui/CONTRIBUTING.md
            </a>{" "}
            for how to add to this page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDirection(direction === "ltr" ? "rtl" : "ltr")}
          className="shrink-0 rounded-md border border-border bg-card px-3 py-1.5 text-13 font-medium text-foreground transition-colors hover:bg-muted"
          aria-label={`Switch to ${direction === "ltr" ? "right-to-left" : "left-to-right"} layout`}
        >
          {direction === "ltr" ? "LTR" : "RTL"}
        </button>
      </div>

      <Section title="Button">
        <div className="flex flex-col gap-4">
          {BUTTON_VARIANTS.map((variant) => (
            <div key={variant} className="flex flex-wrap items-center gap-3">
              <span className="w-20 shrink-0 text-13 text-muted-foreground">
                {variant}
              </span>
              {BUTTON_SIZES.map((size) => (
                <Button key={size} variant={variant} size={size}>
                  {size}
                </Button>
              ))}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Badge">
        <div className="flex flex-wrap items-center gap-3">
          {BADGE_VARIANTS.map((variant) => (
            <Badge key={variant} variant={variant}>
              {variant}
            </Badge>
          ))}
        </div>
      </Section>

      <Section title="Trading density and interruptible presence">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1 rounded-md border border-border p-2 text-11-5 font-mono">
            <span className="bg-long-subtle p-2 text-long">BUY 1.25</span>
            <span className="bg-short-subtle p-2 text-short">SELL 1.25</span>
          </div>
          <button type="button" className="rounded-sm border border-border px-3 py-1.5 text-13" onClick={() => setPresenceOpen(value => !value)}>
            {presenceOpen ? "Close" : "Open"} panel
          </button>
          <InterruptiblePresence present={presenceOpen} className="rounded-md border border-border bg-surface-raised p-3 text-sm">
            Reversible panel content remains mounted during exit and cannot receive focus.
          </InterruptiblePresence>
        </div>
      </Section>

      <Section title="Changelog status badges">
        <div className="grid gap-4 sm:grid-cols-2">
          {CHANGELOG_ENTRY_TYPES.map((type) => (
            <div
              key={type}
              className="flex items-center justify-between gap-4 rounded-md bg-surface-canvas p-3"
            >
              <ChangelogCategoryBadge type={type} />
              <span className="text-xs text-muted-foreground">Canvas</span>
            </div>
          ))}
          {CHANGELOG_ENTRY_TYPES.map((type) => (
            <div
              key={`${type}-raised`}
              className="flex items-center justify-between gap-4 rounded-md bg-surface-raised p-3"
            >
              <ChangelogCategoryBadge type={type} />
              <span className="text-xs text-muted-foreground">Raised</span>
            </div>
          ))}
          <div className="flex items-center gap-3 rounded-md bg-surface-canvas p-3 sm:col-span-2">
            <ChangelogCategoryBadge type="changed" breaking />
            <span className="text-xs text-muted-foreground">
              Breaking marker composes with every category
            </span>
          </div>
        </div>
      </Section>

      <Section title="Input">
        <div className="max-w-sm space-y-3">
          <Input placeholder="Default input" />
          <Input placeholder="Disabled input" disabled />
          <Input aria-invalid placeholder="Invalid input" />
        </div>
      </Section>

      <Section title="Slider">
        <div className="max-w-sm">
          <Slider
            value={sliderValue}
            onValueChange={(value) =>
              setSliderValue(Array.isArray(value) ? [...value] : [value])
            }
            max={100}
            step={1}
          />
          <p className="mt-2 text-13 text-muted-foreground">
            Value: {sliderValue[0]}
          </p>
        </div>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="one" className="max-w-sm">
          <TabsList>
            <TabsTrigger value="one">One</TabsTrigger>
            <TabsTrigger value="two">Two</TabsTrigger>
            <TabsTrigger value="three">Three</TabsTrigger>
          </TabsList>
          <TabsContent value="one">First panel content.</TabsContent>
          <TabsContent value="two">Second panel content.</TabsContent>
          <TabsContent value="three">Third panel content.</TabsContent>
        </Tabs>
      </Section>

      <Section title="Skeleton">
        <div className="max-w-sm space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-20 w-full" />
        </div>
      </Section>

      <Section title="Separator">
        <p className="text-sm text-foreground">Above the separator</p>
        <Separator className="my-3" />
        <p className="text-sm text-foreground">Below the separator</p>

        <div className="mt-6 space-y-3">
          {SEPARATOR_TONES.map((tone) => (
            <div key={tone} className="space-y-2">
              <p className="text-11 text-muted-foreground uppercase">{tone}</p>
              <Separator tone={tone} decorative />
            </div>
          ))}
        </div>

        <div className="mt-6 flex h-10 items-center gap-3 text-sm text-foreground">
          <span>Vertical</span>
          <Separator orientation="vertical" decorative />
          <span>in a flex row</span>
          <Separator orientation="vertical" tone="strong" decorative />
          <span>without a fixed height</span>
        </div>
      </Section>

      <Section title="Divider">
        <div className="space-y-6">
          <Divider label="or" />
          <Divider label="Advanced" align="start" tone="subtle" />
          <Divider label="Yesterday" align="end" tone="strong" />
        </div>
      </Section>

      <Section title="ScrollArea">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-11 text-muted-foreground uppercase">
              Vertical — edge shadows follow scroll position
            </p>
            <ScrollArea
              className="max-h-40 rounded-md border border-border"
              tone="card"
            >
              <div className="space-y-1 p-3">
                {Array.from({ length: 20 }, (_, i) => (
                  <p key={i} className="text-13 text-foreground">
                    Row {i + 1}
                  </p>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="space-y-2">
            <p className="text-11 text-muted-foreground uppercase">
              Horizontal
            </p>
            <ScrollArea
              orientation="horizontal"
              className="rounded-md border border-border"
              tone="card"
            >
              <div className="flex w-max gap-2 p-3">
                {Array.from({ length: 16 }, (_, i) => (
                  <span
                    key={i}
                    className="rounded-md border border-border px-3 py-1 text-13 text-foreground"
                  >
                    Market {i + 1}
                  </span>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </Section>

      <Section title="Accessibility primitives">
        <div className="space-y-4">
          <p className="text-13 text-muted-foreground">
            VisuallyHidden and LiveRegion render nothing visible by default —
            the button below carries a hidden label, and the counter announces
            itself politely. See packages/ui/ACCESSIBILITY_PRIMITIVES.md.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setAnnounceCount((n) => n + 1)}
            >
              Announce
              <VisuallyHidden> a polite status message</VisuallyHidden>
            </Button>
            <LiveRegion
              visible
              message={
                announceCount === 0
                  ? "Nothing announced yet"
                  : `Announced ${announceCount} time(s)`
              }
              announcementKey={announceCount}
              className="text-13 text-muted-foreground"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-13 text-muted-foreground">
              Focusable hidden content (tab to reveal):
            </span>
            <VisuallyHidden focusable>
              <button type="button" className="text-13 text-primary underline">
                Hidden until focused
              </button>
            </VisuallyHidden>
          </div>
        </div>
      </Section>

      <Section title="Tooltip">
        <Tooltip>
          <TooltipTrigger>
            <Button variant="outline">Hover me</Button>
          </TooltipTrigger>
          <TooltipContent>A tooltip, positioned automatically.</TooltipContent>
        </Tooltip>
      </Section>

      <Section title="AppShell">
        <div className="space-y-4">
          <p className="text-13 text-muted-foreground">
            Constrained layout (default) — used for Pools, Earn, Referrals,
            Faucet
          </p>
          <div className="overflow-hidden rounded-lg border border-border">
            <AppShell
              variant="constrained"
              maxWidth="full"
              // Preview only: the real page already owns the <main> landmark
              // and the skip-link target, and neither may be duplicated.
              landmark={false}
              skipLink={false}
              navbar={
                <div className="flex h-10 items-center border-b border-border bg-muted/30 px-4">
                  <span className="text-13 font-medium text-foreground">
                    Navbar slot
                  </span>
                </div>
              }
              banner={
                <div className="bg-warning/10 px-4 py-2 text-13 text-warning">
                  Banner slot
                </div>
              }
            >
              <div className="rounded-lg border border-dashed border-border bg-muted/10 p-8 text-center text-13 text-muted-foreground">
                Content area
              </div>
            </AppShell>
          </div>

          <p className="mt-4 text-13 text-muted-foreground">
            Full layout — used for Trade (fills viewport)
          </p>
          <div className="overflow-hidden rounded-lg border border-border">
            <AppShell
              variant="full"
              landmark={false}
              skipLink={false}
              navbar={
                <div className="flex h-10 items-center border-b border-border bg-muted/30 px-4">
                  <span className="text-13 font-medium text-foreground">
                    Navbar slot
                  </span>
                </div>
              }
            >
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-muted/10 p-8 text-13 text-muted-foreground">
                Full-viewport content area
              </div>
            </AppShell>
          </div>
        </div>
      </Section>

      <Section title="PageHeader">
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-13 text-muted-foreground">
              Minimal — title + description
            </p>
            <div className="rounded-lg border border-border bg-muted/10 p-4">
              <PageHeader
                title="Pools"
                description="Provide liquidity to SO4 GM markets."
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-13 text-muted-foreground">
              With actions slot
            </p>
            <div className="rounded-lg border border-border bg-muted/10 p-4">
              <PageHeader
                title="Earn"
                description="Stake SO4 and earn rewards."
                actions={
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      Filter
                    </Button>
                    <Button size="sm">Claim all</Button>
                  </div>
                }
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-13 text-muted-foreground">
              With metadata + tabs slot
            </p>
            <div className="rounded-lg border border-border bg-muted/10 p-4">
              <PageHeader
                title="Referrals"
                description="Get fee discounts and earn up to 15% commission."
                metadata={
                  <>
                    <Badge variant="success">Active</Badge>
                    <span className="text-13 text-muted-foreground">
                      Tier 3
                    </span>
                  </>
                }
                tabs={
                  <Tabs defaultValue="traders">
                    <TabsList className="h-9">
                      <TabsTrigger value="traders">Traders</TabsTrigger>
                      <TabsTrigger value="affiliates">Affiliates</TabsTrigger>
                      <TabsTrigger value="distributions">
                        Distributions
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                }
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-13 text-muted-foreground">
              With breadcrumbs slot
            </p>
            <div className="rounded-lg border border-border bg-muted/10 p-4">
              <PageHeader
                title="Settings"
                description="Manage your account settings."
                breadcrumbs={
                  <nav className="flex items-center gap-1.5 text-13 text-muted-foreground">
                    <span>Home</span>
                    <span aria-hidden="true">/</span>
                    <span className="text-foreground">Settings</span>
                  </nav>
                }
              />
            </div>
          </div>
        </div>
      </Section>

      <Section title="KeyboardShortcut">
        <div className="flex flex-wrap items-center gap-3">
          <KeyboardShortcut keys={["Mod", "K"]} platform="mac" />
          <KeyboardShortcut keys={["Mod", "Shift", "P"]} platform="mac" />
          <KeyboardShortcut
            keys={["Ctrl", "Alt", "Delete"]}
            platform="windows"
          />
          <KeyboardShortcut keys={["Mod", "S"]} presentation="grouped" />
        </div>
      </Section>

      <Section title="Callout">
        <div className="space-y-4 max-w-lg">
          <Callout variant="note">
            This is a note. It provides supplementary information about the
            current topic.
          </Callout>
          <Callout variant="tip" title="Pro tip">
            This is a tip. It highlights best practices or helpful shortcuts.
          </Callout>
          <Callout variant="warning">
            <p>This is a warning. It alerts the reader to potential issues.</p>
            <pre className="mt-2 rounded-md bg-black/5 p-3 text-xs"><code>const result = await sdk.simulate(tx)</code></pre>
            <ul className="mt-2 list-disc pl-4">
              <li>Always simulate before submitting</li>
              <li>Check the result for errors</li>
            </ul>
          </Callout>
          <Callout variant="caution" title="Caution">
            This is a caution. It warns about irreversible actions or critical
            information.
          </Callout>
        </div>
      </Section>

      <Section title="Card">
        <div className="space-y-6">
          <div>
            <p className="mb-3 text-13 text-muted-foreground">
              Default variant
            </p>
            <Card>
              <CardHeader>
                <CardTitle>Card Title</CardTitle>
                <CardDescription>Card description goes here</CardDescription>
              </CardHeader>
              <CardContent>Content area with default padding</CardContent>
              <CardFooter>
                <Button variant="outline" size="sm">
                  Cancel
                </Button>
                <Button size="sm">Save</Button>
              </CardFooter>
            </Card>
          </div>

          <div>
            <p className="mb-3 text-13 text-muted-foreground">
              Interactive variant
            </p>
            <Card variant="interactive" className="cursor-pointer">
              <CardHeader>
                <CardTitle>Interactive Card</CardTitle>
              </CardHeader>
              <CardContent>Hover to see interactive states</CardContent>
            </Card>
          </div>

          <div>
            <p className="mb-3 text-13 text-muted-foreground">Subtle variant</p>
            <Card variant="subtle">
              <CardHeader>
                <CardTitle>Supporting Information</CardTitle>
              </CardHeader>
              <CardContent>
                Recessed surface for secondary information
              </CardContent>
            </Card>
          </div>

          <div>
            <p className="mb-3 text-13 text-muted-foreground">
              With compact padding
            </p>
            <Card padding="compact">
              <CardHeader>
                <CardTitle>Compact Card</CardTitle>
              </CardHeader>
              <CardContent>Minimal spacing card</CardContent>
            </Card>
          </div>
        </div>
      </Section>

      <Section title="Spinner">
        <div className="space-y-6">
          <div>
            <p className="mb-3 text-13 text-muted-foreground">
              Decorative (hidden from screen readers)
            </p>
            <Spinner />
          </div>
          <div>
            <p className="mb-3 text-13 text-muted-foreground">
              With accessible label
            </p>
            <Spinner label="Loading data..." />
          </div>
        </div>
      </Section>

      <Section title="ProgressIndicator">
        <div className="space-y-6">
          {PROGRESS_SIZES.map((size) => (
            <div key={size}>
              <p className="mb-2 text-13 text-muted-foreground">{size}</p>
              {PROGRESS_TONES.map((tone) => (
                <div key={`${size}-${tone}`} className="mb-3 space-y-1">
                  <span className="text-10 text-text-tertiary">{tone}</span>
                  <ProgressIndicator value={65} size={size} tone={tone} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Avatar">
        <div className="space-y-6">
          <div>
            <p className="mb-3 text-13 text-muted-foreground">All sizes</p>
            <div className="flex items-center gap-4">
              {AVATAR_SIZES.map((size) => (
                <Avatar
                  key={size}
                  size={size}
                  fallback={size.charAt(0).toUpperCase()}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-13 text-muted-foreground">With image</p>
            <div className="flex gap-4">
              <Avatar
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=user1"
                alt="User avatar"
                fallback="AB"
              />
              <Avatar
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=user2"
                alt="Another user"
                fallback="CD"
              />
            </div>
          </div>
        </div>
      </Section>

      <Section title="AvatarGroup">
        <div className="space-y-6">
          <div>
            <p className="mb-3 text-13 text-muted-foreground">
              With maximum visible
            </p>
            <AvatarGroup max={3}>
              <Avatar fallback="A" />
              <Avatar fallback="B" />
              <Avatar fallback="C" />
              <Avatar fallback="D" />
              <Avatar fallback="E" />
            </AvatarGroup>
          </div>

          <div>
            <p className="mb-3 text-13 text-muted-foreground">All visible</p>
            <AvatarGroup>
              <Avatar fallback="X" />
              <Avatar fallback="Y" />
              <Avatar fallback="Z" />
            </AvatarGroup>
          </div>

          <div>
            <p className="mb-3 text-13 text-muted-foreground">
              Without overflow count
            </p>
            <AvatarGroup max={2} showCount={false}>
              <Avatar fallback="A" />
              <Avatar fallback="B" />
              <Avatar fallback="C" />
            </AvatarGroup>
          </div>
        </div>
      </Section>

      <Section title="Landing Typography (GMX)">
        {/* GMX's landing is dark-only (docs/gf_3/001_theme_update.md §7), so
            this swatch forces the `.dark` token scope the same way the
            landing route itself does, independent of the gallery's own
            theme toggle. */}
        <div className="dark space-y-6 bg-background p-6">
          <div>
            <p className="mb-2 text-13 text-muted-foreground">text-heading-1</p>
            <h1 className="text-heading-1 text-foreground">
              Perpetual markets.
            </h1>
          </div>
          <div>
            <p className="mb-2 text-13 text-muted-foreground">text-heading-2</p>
            <h2 className="text-heading-2 text-foreground">
              Built for traders.
            </h2>
          </div>
          <div>
            <p className="mb-2 text-13 text-muted-foreground">text-heading-3</p>
            <h3 className="text-heading-3 text-foreground">Card titles</h3>
          </div>
          <div>
            <p className="mb-2 text-13 text-muted-foreground">text-heading-4</p>
            <h4 className="text-heading-4 text-foreground">
              Small card titles
            </h4>
          </div>
          <div>
            <p className="mb-2 text-13 text-muted-foreground">
              text-subheadline
            </p>
            <p className="text-subheadline">
              Supporting copy under a call to action.
            </p>
          </div>
          <div>
            <p className="mb-2 text-13 text-muted-foreground">
              text-description
            </p>
            <p className="max-w-md text-description">
              Body copy on a dark card surface, set in Archivo at 16px with
              GMX's tracking and line height.
            </p>
          </div>
          <div>
            <p className="mb-2 text-13 text-muted-foreground">btn-landing</p>
            <Button variant="default" className="h-10 btn-landing px-5 text-sm">
              Launch trading app
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Order Book Workspace (OB-009)">
        <div className="space-y-6">
          <div>
            <p className="mb-3 text-13 text-muted-foreground">
              Populated state — typical order book with depth
            </p>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">BTC/USD</h3>
                  <span className="text-13 text-muted-foreground">
                    Mid: $43000.00
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase">
                      Bids
                    </div>
                    <div className="space-y-1 text-13 font-mono">
                      <div className="flex justify-between text-short">
                        <span>42999.98</span>
                        <span>0.50</span>
                      </div>
                      <div className="flex justify-between text-short">
                        <span>42999.50</span>
                        <span>1.20</span>
                      </div>
                      <div className="flex justify-between text-short">
                        <span>42998.00</span>
                        <span>2.00</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase">
                      Asks
                    </div>
                    <div className="space-y-1 text-13 font-mono">
                      <div className="flex justify-between text-long">
                        <span>43000.00</span>
                        <span>0.50</span>
                      </div>
                      <div className="flex justify-between text-long">
                        <span>43000.50</span>
                        <span>1.20</span>
                      </div>
                      <div className="flex justify-between text-long">
                        <span>43002.00</span>
                        <span>2.00</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-3 text-13 text-muted-foreground">
              Loading state — skeleton with pulse animation
            </p>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[...Array(2)].map((_, col) => (
                    <div key={col} className="space-y-2">
                      <Skeleton className="h-4 w-12" />
                      <div className="space-y-1">
                        {[...Array(3)].map((_, row) => (
                          <Skeleton
                            key={row}
                            className="h-5 w-full"
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-3 text-13 text-muted-foreground">
              Empty state — no liquidity available
            </p>
            <div className="rounded-lg border border-dashed border-border bg-muted/5 p-8 text-center">
              <div className="flex justify-center">
                <Spinner />
              </div>
              <p className="mt-3 text-13 text-muted-foreground">
                Waiting for market data...
              </p>
            </div>
          </div>

          <div>
            <p className="mb-3 text-13 text-muted-foreground">
              Disconnected/error state
            </p>
            <div className="rounded-lg border border-dashed border-danger bg-danger-subtle p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-2 w-2 rounded-full bg-danger shrink-0" />
                <div>
                  <p className="text-13 font-semibold text-danger">
                    Connection lost
                  </p>
                  <p className="mt-1 text-13 text-muted-foreground">
                    Order book feed is temporarily unavailable. Reconnecting...
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-3 text-13 text-muted-foreground">
              Stale data indicator
            </p>
            <div className="rounded-lg border border-warning bg-warning-subtle p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-2 w-2 rounded-full bg-warning shrink-0" />
                <div>
                  <p className="text-13 font-semibold text-warning">
                    Data may be outdated
                  </p>
                  <p className="mt-1 text-13 text-muted-foreground">
                    Market feed last updated 2 minutes ago
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-3 text-13 text-muted-foreground">
              Transaction feedback — different stages
            </p>
            <div className="space-y-3">
              <Callout variant="note">
                <p className="font-semibold">Order submitted</p>
                <p className="mt-1 text-13">
                  Your market buy order for 0.5 BTC is being processed.
                </p>
              </Callout>
              <Callout variant="tip">
                <p className="font-semibold">Order accepted</p>
                <p className="mt-1 text-13">
                  Order confirmed by the network at price $42,999.98.
                </p>
              </Callout>
              <Callout variant="caution">
                <p className="font-semibold">Partially filled</p>
                <p className="mt-1 text-13">
                  0.25 of 0.5 BTC filled. Remaining order active.
                </p>
              </Callout>
            </div>
          </div>
        </div>
      </Section>
    </main>
  )
}
