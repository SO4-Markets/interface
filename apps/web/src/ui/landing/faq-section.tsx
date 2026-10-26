import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"

import { LANDING_FAQS } from "./faq.generated"
import { DOCS_URL } from "@/shared/lib/site-identity"

const DOCS_ORIGIN = DOCS_URL

export function FaqSection() {
  return (
    <section className="bg-gmx-slate-900 px-4 py-20 sm:px-10 sm:py-30">
      <div className="mx-auto flex max-w-300 flex-col gap-9 lg:flex-row lg:gap-30">
        <h2 className="text-heading-2 text-white">FAQ</h2>

        {/* The shared accordion already implements GMX's expand mechanic —
            a grid-rows 0fr→1fr transition, no JS height measurement — plus
            the aria-controls/labelledby wiring and focus-visible ring. Only
            the landing's typography and hairline rules are restyled here. */}
        <Accordion type="single" collapsible className="lg:w-200">
          {LANDING_FAQS.map((item) => (
            <AccordionItem
              key={item.id}
              value={item.id}
              className="border-b-hairline border-gmx-slate-600 last:border-b-hairline"
            >
              <AccordionTrigger
                headingLevel={3}
                className="py-7 text-heading-4 text-white hover:text-gmx-blue-400 focus-visible:ring-gmx-blue-400/40 [&_svg]:size-6 [&_svg]:text-gmx-slate-500"
              >
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-description">
                <p className="pt-4 pb-7">
                  {item.answer}{" "}
                  <a
                    href={`${DOCS_ORIGIN}${item.href}`}
                    className="text-gmx-blue-400 underline-offset-4 hover:underline"
                  >
                    {item.linkLabel}
                  </a>
                </p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
